import { createHash } from "node:crypto";
import { env } from "./env";
import { jerusalemDateString } from "./time";

/**
 * Produce a coarse, non-reversible visitor hash for anonymous analytics.
 * Rotates daily (salted with the date) so it cannot be used for long-term
 * tracking. No raw IP or user-agent is ever stored.
 */
export function visitorHash(ip: string, userAgent: string, date = jerusalemDateString()): string {
  return createHash("sha256")
    .update(`${env.SESSION_SECRET}|${date}|${ip}|${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}
