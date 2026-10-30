import { describe, expect, it } from "vitest";
import { mealFor, nowRounded, timeFor } from "./TimePicker";

describe("timeFor", () => {
  it("keeps a typed time that already falls in the picked meal", () => {
    expect(timeFor("lunch", "12:40")).toBe("12:40");
  });

  it("moves to the meal's usual time when the typed time is outside it", () => {
    expect(timeFor("dinner", "09:00")).toBe("19:30");
  });
});

describe("nowRounded", () => {
  it("rounds to the nearest 5 minutes", () => {
    expect(nowRounded(new Date(2026, 9, 30, 14, 22))).toBe("14:20");
    expect(nowRounded(new Date(2026, 9, 30, 14, 23))).toBe("14:25");
  });

  it("carries 60 minutes into the next hour", () => {
    expect(nowRounded(new Date(2026, 9, 30, 14, 58))).toBe("15:00");
  });
});

describe("mealFor", () => {
  it("suggests the meal a time of day usually belongs to", () => {
    expect(mealFor("08:00")).toBe("breakfast");
    expect(mealFor("13:00")).toBe("lunch");
    expect(mealFor("16:30")).toBe("snack");
    expect(mealFor("19:30")).toBe("dinner");
  });
});
