import { describe, expect, it } from "vitest";
import { addDays, mondayOf, utcDay } from "./dates";

describe("utcDay", () => {
  it("formats a date as a UTC calendar day", () => {
    expect(utcDay(new Date("2026-10-29T23:30:00Z"))).toBe("2026-10-29");
  });
});

describe("addDays", () => {
  it("moves across month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });
});

describe("mondayOf", () => {
  it("finds the Monday of the week, starting Monday", () => {
    expect(mondayOf("2026-10-29")).toBe("2026-10-26"); // a Thursday
    expect(mondayOf("2026-10-26")).toBe("2026-10-26"); // already a Monday
    expect(mondayOf("2026-11-01")).toBe("2026-10-26"); // a Sunday
  });
});
