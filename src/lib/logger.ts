import pino from "pino";
import { env } from "./env";

/**
 * Structured logger. Production (`next start`) emits newline-delimited JSON that
 * PM2 / Hostinger collect to a file. In development we pretty-print — but via an
 * in-process transform stream, NOT pino's worker-thread transport (which Next's
 * dev webpack fails to bundle, crashing the dev server).
 */
const options: pino.LoggerOptions = {
  level: env.LOG_LEVEL,
  base: { app: "trendfinder" },
  redact: {
    paths: [
      "*.OPENAI_API_KEY",
      "*.apiKey",
      "*.password",
      "*.passwordHash",
      "*.SESSION_SECRET",
      "*.ALIEXPRESS_AFFILIATE_KEY",
      "*.ALIEXPRESS_AFFILIATE_SECRET",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[redacted]",
  },
};

let stream: NodeJS.WritableStream | undefined;
if (env.NODE_ENV === "development") {
  try {
    // eslint-disable-next-line
    const pretty = require("pino-pretty");
    stream = pretty({ colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname,app" });
  } catch {
    /* fall back to JSON */
  }
}

export const logger = stream ? pino(options, stream) : pino(options);

export function child(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
