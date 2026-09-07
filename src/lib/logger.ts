import pino from "pino";
import { env } from "./env";

/**
 * Structured logger. In development it pretty-prints; in production it emits
 * newline-delimited JSON that PM2 / Hostinger can collect to a log file.
 */
export const logger = pino({
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
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
      : undefined,
});

export function child(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
