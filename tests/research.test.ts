import { describe, it, expect } from "vitest";
import { extractJson } from "@/services/openai/OpenAIService";
import { trendResearchSchema, productPickSchema } from "@/services/types";
import { MockAIProvider } from "@/services/openai/MockAIProvider";
import { AliExpressResearchService } from "@/services/aliexpress/AliExpressResearchService";
import { parseOrders } from "@/services/aliexpress/aeSearch";

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

describe("parseOrders", () => {
  it("handles AliExpress order strings", () => {
    expect(parseOrders("404 sold")).toBe(404);
    expect(parseOrders("1,000+ sold")).toBe(1000);
    expect(parseOrders("5000+ sold")).toBe(5000);
    expect(parseOrders("316 נמכרו")).toBe(316);
    expect(parseOrders(null)).toBeNull();
  });
});

describe("MockAIProvider produces schema-valid payloads", () => {
  it("trend research validates", async () => {
    const ai = new MockAIProvider();
    const res = await ai.generate({ system: "s", user: "u", webSearch: true, operation: "trend.research.trend" });
    const parsed = trendResearchSchema.parse(extractJson(res.text));
    expect(parsed.trend.title.length).toBeGreaterThan(2);
    expect(parsed.searchQueries.length).toBeGreaterThanOrEqual(1);
  });

  it("product pick validates and echoes an id from the prompt", async () => {
    const ai = new MockAIProvider();
    const res = await ai.generate({
      system: "s",
      user: "1. id=1005006789012345 | thing | 5 USD | rating 4.5 | orders 300",
      operation: "trend.pick.product",
    });
    const parsed = productPickSchema.parse(extractJson(res.text));
    expect(parsed.chosenProductId).toBe("1005006789012345");
  });
});

describe("AliExpressResearchService", () => {
  it("canonicalises the item URL and extracts the product id", () => {
    const { url, id } = AliExpressResearchService.canonicalUrl(
      "https://he.aliexpress.com/item/1005006789012345.html?spm=abc",
    );
    expect(url).toBe("https://www.aliexpress.com/item/1005006789012345.html");
    expect(id).toBe("1005006789012345");
  });

  it("toRealProduct marks real fields VERIFIED and missing ones UNAVAILABLE", () => {
    const rp = AliExpressResearchService.toRealProduct({
      productId: "1005006789012345",
      url: "https://www.aliexpress.com/item/1005006789012345.html",
      title: "Sunset projection lamp USB",
      image: "https://ae01.alicdn.com/kf/x.jpg",
      images: ["https://ae01.alicdn.com/kf/x.jpg"],
      priceOriginal: 5.99,
      currencyOriginal: "USD",
      rating: 4.6,
      orders: 800,
      storeName: "Lamp Store",
      _score: 1,
    });
    expect(rp.dataConfidence.price).toBe("VERIFIED");
    expect(rp.dataConfidence.images).toBe("VERIFIED");
    expect(AliExpressResearchService.qualityCheck(rp).ok).toBe(true);
  });

  it("qualityCheck fails a product with no image or no price", () => {
    const base = {
      productId: "1005006789012345",
      url: "https://www.aliexpress.com/item/1005006789012345.html",
      title: "Some product title",
      image: null,
      images: [],
      priceOriginal: null,
      currencyOriginal: null,
      rating: null,
      orders: null,
      storeName: null,
      _score: 0,
    };
    expect(AliExpressResearchService.qualityCheck(AliExpressResearchService.toRealProduct(base)).ok).toBe(false);
  });
});
