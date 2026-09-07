import OpenAI from "openai";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { ConfigError } from "@/lib/errors";

export interface AICallOptions {
  system: string;
  user: string;
  /** Enable OpenAI's hosted web_search tool. */
  webSearch?: boolean;
  /** Prefer the lighter model (scoring / classification). */
  light?: boolean;
  /** Attach the call to a generation run for the admin audit log. */
  runId?: string;
  operation: string;
  /** Soft cap on output tokens. */
  maxOutputTokens?: number;
}

export interface AITextResult {
  text: string;
  model: string;
  /** URLs surfaced by the web_search tool, if any. */
  webSources: { url: string; title?: string }[];
  usage?: { input?: number; output?: number };
  raw?: unknown;
}

export interface AIProvider {
  readonly name: string;
  generate(opts: AICallOptions): Promise<AITextResult>;
}

/** Extract the first balanced JSON object/array from a string. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  // strip ```json fences if present
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    /* fall through to bracket scan */
  }
  const start = unfenced.search(/[{[]/);
  if (start === -1) throw new SyntaxError("No JSON found in AI output");
  const open = unfenced[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < unfenced.length; i++) {
    const ch = unfenced[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return JSON.parse(unfenced.slice(start, i + 1));
    }
  }
  throw new SyntaxError("Unbalanced JSON in AI output");
}

// ─────────────────────────────────────────────────────────────────────────────
// Real OpenAI provider (Responses API + web_search)
// ─────────────────────────────────────────────────────────────────────────────

class OpenAIRealProvider implements AIProvider {
  readonly name = "openai";
  private client: OpenAI;

  constructor() {
    if (!env.OPENAI_API_KEY) {
      throw new ConfigError(
        "OPENAI_API_KEY is not set but AI_PROVIDER=openai. Set the key or use AI_PROVIDER=mock.",
      );
    }
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  async generate(opts: AICallOptions): Promise<AITextResult> {
    const model = opts.light ? env.OPENAI_MODEL_LIGHT : env.OPENAI_MODEL;
    const started = Date.now();
    let ok = false;
    let httpStatus: number | undefined;
    let errorText: string | undefined;
    let result: AITextResult | undefined;

    try {
      const response = await this.client.responses.create({
        model,
        input: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        // Tool id differs across OpenAI SDK / model versions ("web_search" vs
        // "web_search_preview"). We send the modern name and cast; if your
        // account needs the preview id, change it here.
        tools: opts.webSearch
          ? ([{ type: "web_search" }] as unknown as OpenAI.Responses.Tool[])
          : undefined,
        max_output_tokens: opts.maxOutputTokens ?? 4000,
      });

      const text =
        // SDK convenience getter
        (response as unknown as { output_text?: string }).output_text ??
        collectOutputText(response);

      const webSources = collectWebSources(response);

      result = {
        text,
        model,
        webSources,
        usage: {
          input: (response as any).usage?.input_tokens,
          output: (response as any).usage?.output_tokens,
        },
        raw: response,
      };
      ok = true;
      return result;
    } catch (err: any) {
      httpStatus = err?.status;
      errorText = err?.message ?? String(err);
      logger.error({ err, operation: opts.operation }, "OpenAI call failed");
      throw err;
    } finally {
      await safeLog({
        runId: opts.runId,
        provider: "openai",
        operation: opts.operation,
        ok,
        httpStatus,
        durationMs: Date.now() - started,
        errorText,
        meta: {
          model,
          webSearch: Boolean(opts.webSearch),
          promptChars: opts.system.length + opts.user.length,
          outputChars: result?.text.length,
          sources: result?.webSources.length,
        },
      });
    }
  }
}

function collectOutputText(response: unknown): string {
  const out = (response as any)?.output;
  if (!Array.isArray(out)) return "";
  const parts: string[] = [];
  for (const item of out) {
    if (item?.type === "message" && Array.isArray(item.content)) {
      for (const c of item.content) {
        if (typeof c?.text === "string") parts.push(c.text);
      }
    }
  }
  return parts.join("\n");
}

function collectWebSources(response: unknown): { url: string; title?: string }[] {
  const seen = new Map<string, { url: string; title?: string }>();
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.url === "string" && /^https?:\/\//.test(node.url)) {
      if (!seen.has(node.url))
        seen.set(node.url, { url: node.url, title: node.title });
    }
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") walk(v);
    }
  };
  walk((response as any)?.output);
  return [...seen.values()];
}

async function safeLog(entry: {
  runId?: string;
  provider: string;
  operation: string;
  ok: boolean;
  httpStatus?: number;
  durationMs?: number;
  errorText?: string;
  meta?: unknown;
}) {
  try {
    await prisma.apiLog.create({
      data: {
        runId: entry.runId ?? null,
        provider: entry.provider,
        operation: entry.operation,
        ok: entry.ok,
        httpStatus: entry.httpStatus ?? null,
        durationMs: entry.durationMs ?? null,
        errorText: entry.errorText ?? null,
        meta: (entry.meta as any) ?? undefined,
      },
    });
  } catch (err) {
    logger.warn({ err }, "failed to persist api log");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider factory
// ─────────────────────────────────────────────────────────────────────────────

let cached: AIProvider | null = null;

export async function getAIProvider(): Promise<AIProvider> {
  if (cached) return cached;
  if (env.AI_PROVIDER === "mock") {
    const { MockAIProvider } = await import("./MockAIProvider");
    cached = new MockAIProvider();
  } else {
    // AI_PROVIDER=openai — do NOT silently fall back to mock. If the key is
    // missing the generation run must fail loudly so the operator sees why.
    if (!env.OPENAI_API_KEY) {
      throw new ConfigError(
        "AI_PROVIDER=openai but OPENAI_API_KEY is empty. Add your OpenAI key to .env and restart the server. " +
          "(Set AI_PROVIDER=mock to intentionally run with offline fake data.)",
      );
    }
    cached = new OpenAIRealProvider();
  }
  logger.info({ provider: cached.name }, "AI provider initialised");
  return cached;
}

/** test helper */
export function __setAIProvider(p: AIProvider | null) {
  cached = p;
}
