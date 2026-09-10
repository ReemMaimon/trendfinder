import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { deriveSource, deriveDevice } from "@/lib/visitor";
import { AnalyticsService } from "@/services/analytics/AnalyticsService";

describe("deriveSource", () => {
  it("maps referrers to a source", () => {
    expect(deriveSource(null)).toBe("direct");
    expect(deriveSource("https://www.google.com/search?q=x")).toBe("google");
    expect(deriveSource("https://l.instagram.com/")).toBe("instagram");
    expect(deriveSource("https://www.tiktok.com/@x")).toBe("tiktok");
    expect(deriveSource("android-app://com.whatsapp/")).toBe("whatsapp");
    expect(deriveSource("https://web.whatsapp.com/")).toBe("whatsapp");
    expect(deriveSource("https://some-random-blog.example/post")).toBe("other");
  });
  it("prefers utm_source", () => {
    expect(deriveSource("https://www.google.com/", "whatsapp")).toBe("whatsapp");
    expect(deriveSource(null, "instagram_bio")).toBe("instagram");
  });
});

describe("deriveDevice", () => {
  it("classifies user agents", () => {
    expect(deriveDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148")).toBe("mobile");
    expect(deriveDevice("Mozilla/5.0 (iPad; CPU OS 17_0) AppleWebKit")).toBe("tablet");
    expect(deriveDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
    expect(deriveDevice("")).toBe("unknown");
  });
});

describe("AnalyticsService.resolveRange", () => {
  it("today/yesterday use hourly granularity", () => {
    expect(AnalyticsService.resolveRange("today").granularity).toBe("hour");
    expect(AnalyticsService.resolveRange("yesterday").granularity).toBe("hour");
  });
  it("7d spans 7 calendar days, daily granularity", () => {
    const r = AnalyticsService.resolveRange("7d");
    expect(r.granularity).toBe("day");
    const days =
      (Date.parse(r.toDate) - Date.parse(r.fromDate)) / 86400000;
    expect(Math.round(days)).toBe(6);
    expect(r.toTs.getTime()).toBeGreaterThan(r.fromTs.getTime());
  });
  it("custom range swaps reversed dates", () => {
    const r = AnalyticsService.resolveRange("custom", "2026-09-10", "2026-09-01");
    expect(r.fromDate).toBe("2026-09-01");
    expect(r.toDate).toBe("2026-09-10");
  });
});
