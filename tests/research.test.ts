import { describe, it, expect } from "vitest";
import { extractJson } from "@/services/openai/OpenAIService";
import { researchCandidateSchema } from "@/services/types";
import { MockAIProvider } from "@/services/openai/MockAIProvider";
import { AliExpressResearchService } from "@/services/aliexpress/AliExpressResearchService";

describe("extractJson", () => {
  it("parses fenced json", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("parses json embedded in prose", () => {
    expect(extractJson('here is the result: {"a":{"b":2}} thanks')).toEqual({ a: { b: 2 } });
  });
  it("throws on no json", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("MockAIProvider produces schema-valid research candidates", () => {
  it("validates against researchCandidateSchema", async () => {
    const ai = new MockAIProvider();
    const res = await ai.generate({ system: "s", user: "u", webSearch: true, operation: "trend.research.candidate" });
    const parsed = researchCandidateSchema.parse(extractJson(res.text));
    expect(parsed.trend.title.length).toBeGreaterThan(2);
    if (parsed.productFound) {
      expect(parsed.product?.aeUrl).toMatch(/^https:\/\/www\.aliexpress\.com\/item\//);
    }
  });
});

describe("AliExpressResearchService.normalize", () => {
  it("rejects non-AliExpress URLs", async () => {
    const candidate = researchCandidateSchema.parse({
      trend: { title: "trend", description: "a description that is long enough", category: "Gadgets" },
      productFound: true,
      product: {
        aeTitle: "thing",
        aeUrl: "https://example.com/item/123.html",
        aeImages: [],
        dataConfidence: {},
        candidateListingsCompared: [],
      },
      socialSignals: {
        tiktok: { level: "LOW", reasoning: "" },
        instagram: { level: "LOW", reasoning: "" },
        youtube: { level: "LOW", reasoning: "" },
        googleTrends: { level: "LOW", reasoning: "" },
      },
      sources: [],
    });
    const np = await AliExpressResearchService.normalize(candidate, { corroborate: false });
    expect(np).toBeNull();
  });

  it("canonicalises the item URL and extracts the product id", () => {
    const { url, id } = AliExpressResearchService.canonicalUrl(
      "https://he.aliexpress.com/item/1005006789012345.html?spm=abc",
    );
    expect(url).toBe("https://www.aliexpress.com/item/1005006789012345.html");
    expect(id).toBe("1005006789012345");
  });

  it("quality check fails when there is no image and no price", () => {
    const res = AliExpressResearchService.qualityCheck({
      aeTitle: "x",
      aeUrl: "https://www.aliexpress.com/item/1.html",
      aeImages: [],
      priceOriginal: null,
      dataConfidence: { url: "VERIFIED" },
    } as any);
    expect(res.ok).toBe(false);
  });
});
