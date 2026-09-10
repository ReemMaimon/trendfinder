import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "./env";
import { jerusalemDateString } from "./time";

/**
 * Anonymous analytics identity + request dimensions. No personal data is stored:
 *  - visitorHash: sha256(secret|day|ip|ua), truncated. Rotates DAILY — used for
 *    same-day de-duplication only.
 *  - sessionId: an opaque random first-party cookie ("tf_sid"), ~1 year. Used to
 *    estimate unique visitors across days. Contains no user info.
 */

const SID_COOKIE = "tf_sid";
const SID_MAX_AGE = 365 * 24 * 60 * 60;

export function visitorHash(ip: string, userAgent: string, date = jerusalemDateString()): string {
  return createHash("sha256")
    .update(`${env.SESSION_SECRET}|${date}|${ip}|${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}

/** Read the tf_sid cookie, creating + setting it if absent. Call from a route
 *  handler (it writes a Set-Cookie on the response). */
export function getOrCreateSessionId(): string {
  const jar = cookies();
  const existing = jar.get(SID_COOKIE)?.value;
  if (existing && /^[a-f0-9]{24,40}$/.test(existing)) return existing;
  const sid = randomBytes(16).toString("hex");
  jar.set(SID_COOKIE, sid, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SID_MAX_AGE,
  });
  return sid;
}

/** Best-effort traffic source from a referrer URL and/or utm_source. */
export function deriveSource(referrer: string | null | undefined, utmSource?: string | null): string {
  const utm = (utmSource || "").trim().toLowerCase();
  if (utm) {
    if (/whats?app|wa/.test(utm)) return "whatsapp";
    if (/insta/.test(utm)) return "instagram";
    if (/tiktok|tt/.test(utm)) return "tiktok";
    if (/face|fb/.test(utm)) return "facebook";
    if (/google|goog|gads?/.test(utm)) return "google";
    return utm.slice(0, 30);
  }
  const ref = (referrer || "").trim();
  if (!ref) return "direct";
  let host = "";
  try {
    host = new URL(ref).hostname.toLowerCase();
  } catch {
    if (ref.startsWith("android-app://")) host = ref.slice("android-app://".length);
    else return "other";
  }
  if (/whatsapp|wa\.me/.test(host) || host.includes("com.whatsapp")) return "whatsapp";
  if (/(^|\.)instagram\./.test(host) || host.includes("com.instagram")) return "instagram";
  if (/(^|\.)tiktok\./.test(host) || host.includes("zhiliaoapp")) return "tiktok";
  if (/(^|\.)(facebook|fb)\./.test(host) || host.includes("com.facebook")) return "facebook";
  if (/(^|\.)(google|bing|duckduckgo|yahoo)\./.test(host)) return "google";
  try {
    if (host === new URL(env.SITE_URL).hostname.toLowerCase()) return "internal";
  } catch {
    /* ignore */
  }
  return "other";
}

export function deriveDevice(userAgent: string | null | undefined): string {
  const ua = (userAgent || "").toLowerCase();
  if (!ua) return "unknown";
  if (/ipad|tablet|(android(?!.*mobile))|kindle|playbook|silk/.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|blackberry|opera mini|iemobile/.test(ua)) return "mobile";
  return "desktop";
}
