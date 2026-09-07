import { createHash } from "node:crypto";

/** URL-safe slug from a (possibly Hebrew) title, with a short hash suffix. */
export function makeSlug(title: string, salt = ""): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9֐-׿]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const hash = createHash("sha1")
    .update(`${title}|${salt}`)
    .digest("hex")
    .slice(0, 6);
  return `${base || "product"}-${hash}`;
}
