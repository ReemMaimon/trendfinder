import { describe, it, expect } from "vitest";
import { addDays, previousDates, jerusalemDateString } from "@/lib/time";

describe("date helpers", () => {
  it("addDays crosses month boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("previousDates returns N days, newest first, excluding the given date", () => {
    expect(previousDates("2026-09-07", 3)).toEqual(["2026-09-06", "2026-09-05", "2026-09-04"]);
  });

  it("jerusalemDateString returns YYYY-MM-DD", () => {
    expect(jerusalemDateString(new Date("2026-09-07T10:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("handles the Israel DST spring-forward without shifting the calendar day", () => {
    // 2026 DST starts 2026-03-27. A day before/after must still be adjacent.
    expect(addDays("2026-03-27", 1)).toBe("2026-03-28");
    expect(addDays("2026-03-28", -1)).toBe("2026-03-27");
  });
});
