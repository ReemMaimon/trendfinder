import { describe, it, expect } from "vitest";
import { DiversityService, jaccard, tokenize } from "@/services/diversity/DiversityService";
import { DEFAULT_SETTINGS } from "@/config/defaults";

const rules = DEFAULT_SETTINGS.diversityRules;

const item = (over: Partial<Parameters<typeof DiversityService.evaluate>[0]> = {}) => ({
  title: "Magnetic desk cable organizer",
  trendTitle: "Magnetic desk cable organizer trend",
  trendDescription: "A magnetic puck that holds charging cables on the desk edge",
  category: "Gadgets",
  aeProductId: null,
  ...over,
});

describe("similarity", () => {
  it("jaccard is 1 for identical token sets and 0 for disjoint", () => {
    expect(jaccard(tokenize("alpha beta gamma"), tokenize("alpha beta gamma"))).toBe(1);
    expect(jaccard(tokenize("alpha beta"), tokenize("delta epsilon"))).toBe(0);
  });

  it("flags near-duplicate products in the same day", () => {
    const res = DiversityService.evaluate(
      item({ category: "Home" }),
      [item({ title: "Magnetic desk cable holder", trendTitle: "Magnetic desk cable holder", category: "Home" })],
      [],
      { ...rules, enforceDistinctCategories: false },
    );
    expect(res.ok).toBe(false);
  });

  it("rejects same AliExpress product id outright", () => {
    const hit = DiversityService.maxSimilarity(item({ aeProductId: "123456789" }), [
      item({ title: "totally different thing", aeProductId: "123456789" }),
    ]);
    expect(hit.score).toBe(1);
  });

  it("enforces distinct categories when enabled", () => {
    const res = DiversityService.evaluate(
      item({ trendTitle: "unique gaming gadget", title: "unique gaming gadget" }),
      [item({ trendTitle: "kitchen thing", title: "kitchen thing", category: "Gadgets" })],
      [],
      rules,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe("REJECTED_SIMILAR");
  });

  it("accepts a genuinely different product", () => {
    const res = DiversityService.evaluate(
      {
        trendTitle: "rechargeable spice grinder",
        title: "rechargeable spice grinder",
        trendDescription: "one-hand electric grinder for pepper and salt",
        category: "Kitchen",
        aeProductId: null,
      },
      [
        {
          trendTitle: "sunset projector lamp",
          title: "sunset projector lamp",
          trendDescription: "warm sunset arc projected on the wall for room videos",
          category: "Home",
          aeProductId: null,
        },
      ],
      [],
      rules,
    );
    expect(res.ok).toBe(true);
  });

  it("rejects products too similar to recent history", () => {
    const res = DiversityService.evaluate(
      item({ category: "Kitchen" }),
      [],
      [item({ category: "Home" })],
      { ...rules, maxHistorySimilarity: 0.3 },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe("REJECTED_DUPLICATE");
  });
});
