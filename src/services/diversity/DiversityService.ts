import type { DiversityRules } from "@/config/defaults";
import { normalizeCategory } from "@/config/categories";

/**
 * Similarity + diversity checks. Used to reject near-duplicate products both
 * within a single day's set and against recently published products.
 *
 * Similarity is a token-based Jaccard score over the normalised
 * (title + trend title + trend description) text, with a small boost when the
 * numeric AliExpress product id matches exactly.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "for", "and", "or", "with", "of", "to", "in", "on", "by",
  "aliexpress", "listing", "product", "mock", "new", "mini", "portable", "usb",
  "rechargeable", "set", "pcs", "pack",
]);

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9֐-׿\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface DiversityItem {
  title: string;
  trendTitle: string;
  trendDescription: string;
  category: string;
  aeProductId?: string | null;
}

function signature(it: DiversityItem): Set<string> {
  return tokenize(`${it.trendTitle} ${it.title} ${it.trendDescription}`);
}

export interface SimilarityHit {
  score: number;
  reason: string;
}

export const DiversityService = {
  /** Highest similarity of `candidate` against any item in `others`. */
  maxSimilarity(candidate: DiversityItem, others: DiversityItem[]): SimilarityHit {
    const sig = signature(candidate);
    let best: SimilarityHit = { score: 0, reason: "" };
    for (const o of others) {
      if (
        candidate.aeProductId &&
        o.aeProductId &&
        candidate.aeProductId === o.aeProductId
      ) {
        return { score: 1, reason: `same AliExpress product id ${o.aeProductId}` };
      }
      const s = jaccard(sig, signature(o));
      if (s > best.score) {
        best = { score: s, reason: `text similarity ${(s * 100).toFixed(0)}% with "${o.title}"` };
      }
    }
    return best;
  },

  /**
   * Decide whether a candidate can be accepted into today's set.
   * `todaysAccepted` are the products already chosen today.
   * `recentHistory` are products published in the lookback window.
   */
  evaluate(
    candidate: DiversityItem,
    todaysAccepted: DiversityItem[],
    recentHistory: DiversityItem[],
    rules: DiversityRules,
  ):
    | { ok: true }
    | { ok: false; status: "REJECTED_SIMILAR" | "REJECTED_DUPLICATE"; reason: string } {
    if (rules.enforceDistinctCategories) {
      const cat = normalizeCategory(candidate.category);
      if (todaysAccepted.some((a) => normalizeCategory(a.category) === cat)) {
        return {
          ok: false,
          status: "REJECTED_SIMILAR",
          reason: `category "${cat}" already used today (distinct categories enforced)`,
        };
      }
    }

    const todayHit = this.maxSimilarity(candidate, todaysAccepted);
    if (todayHit.score >= rules.maxTitleSimilarity) {
      return {
        ok: false,
        status: "REJECTED_SIMILAR",
        reason: `too similar to another product today — ${todayHit.reason}`,
      };
    }

    const histHit = this.maxSimilarity(candidate, recentHistory);
    if (histHit.score >= rules.maxHistorySimilarity) {
      return {
        ok: false,
        status: "REJECTED_DUPLICATE",
        reason: `too similar to a recently published product — ${histHit.reason}`,
      };
    }

    return { ok: true };
  },
};
