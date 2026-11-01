// Unusual inputs for the time, protein and week rules. Each case protects a real screen.
import { describe, expect, it } from "vitest";
import { mealFor, nowRounded, timeFor } from "./screens/TimePicker";
import { macroShares } from "./screens/MacroSplit";
import { proteinTier, savedLine, weekLines } from "./encouragement";

describe("time and meal edges", () => {
  it("rounds 23:58 over midnight to 00:00 without a bad hour", () => {
    expect(nowRounded(new Date(2026, 9, 30, 23, 58))).toBe("00:00");
  });

  it("switches meal exactly at the window boundaries", () => {
    expect(mealFor("09:59")).toBe("breakfast");
    expect(mealFor("10:00")).toBe("lunch");
    expect(mealFor("14:59")).toBe("lunch");
    expect(mealFor("15:00")).toBe("snack");
    expect(mealFor("17:59")).toBe("snack");
    expect(mealFor("18:00")).toBe("dinner");
    expect(mealFor("23:59")).toBe("dinner");
    expect(mealFor("00:00")).toBe("breakfast");
  });

  it("moves a meal's time only when the typed time is outside its window", () => {
    expect(timeFor("dinner", "17:00")).toBe("19:30");
    expect(timeFor("lunch", "13:00")).toBe("13:00");
  });
});

describe("protein edges", () => {
  it("gives no tier for a zero or negative target", () => {
    expect(proteinTier(50, 0)).toBeNull();
    expect(proteinTier(50, -10)).toBeNull();
  });

  it("gives no tier when the protein figure is not a number", () => {
    expect(proteinTier(Number.NaN, 100)).toBeNull();
  });

  it("keeps the calm line when there is no target at all", () => {
    expect(savedLine(120, null)).toBe("Logged. Nice work keeping track.");
  });
});

describe("week and macro edges", () => {
  it("shows the first-log invitation for an empty week list", () => {
    expect(weekLines([], null)).toEqual(["Log a meal and your week will show up here."]);
  });

  it("returns no split when every total is zero", () => {
    expect(macroShares({ protein_g: 0, carbs_g: 0, fat_g: 0 })).toBeNull();
  });
});
