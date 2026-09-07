import { describe, it, expect } from "vitest";
import { computeOverall } from "@/services/scoring/ProductScoringService";
import { DEFAULT_SETTINGS } from "@/config/defaults";

const w = DEFAULT_SETTINGS.scoringWeights;

describe("computeOverall", () => {
  it("gives 100 for a perfect, zero-saturation product", () => {
    expect(
      computeOverall(
        {
          viralPotentialScore: 100,
          affiliatePotentialScore: 100,
          noveltyScore: 100,
          trendMomentumScore: 100,
          saturationScore: 0,
        },
        w,
      ),
    ).toBe(100);
  });

  it("gives 0 for a fully saturated, zero-potential product", () => {
    expect(
      computeOverall(
        {
          viralPotentialScore: 0,
          affiliatePotentialScore: 0,
          noveltyScore: 0,
          trendMomentumScore: 0,
          saturationScore: 100,
        },
        w,
      ),
    ).toBe(0);
  });

  it("penalises saturation", () => {
    const base = {
      viralPotentialScore: 80,
      affiliatePotentialScore: 80,
      noveltyScore: 80,
      trendMomentumScore: 80,
      saturationScore: 10,
    };
    const saturated = { ...base, saturationScore: 90 };
    expect(computeOverall(saturated, w)).toBeLessThan(computeOverall(base, w));
  });

  it("clamps to 0..100", () => {
    const s = computeOverall(
      { viralPotentialScore: 100, affiliatePotentialScore: 100, noveltyScore: 100, trendMomentumScore: 100, saturationScore: 100 },
      { ...w, saturationPenalty: 5 },
    );
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});
