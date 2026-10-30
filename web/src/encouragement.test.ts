import { describe, expect, it } from "vitest";
import { proteinTier, savedLine, weekLines } from "./encouragement";

describe("proteinTier", () => {
  it("gives good at 80%, great at 90% and amazing at 100%", () => {
    expect(proteinTier(80, 100)).toBe("good");
    expect(proteinTier(90, 100)).toBe("great");
    expect(proteinTier(100, 100)).toBe("amazing");
    expect(proteinTier(130, 100)).toBe("amazing");
  });

  it("gives no tier below 80%, or without a target", () => {
    expect(proteinTier(79, 100)).toBeNull();
    expect(proteinTier(200, null)).toBeNull();
  });
});

describe("savedLine", () => {
  it("names the tier reached, and stays calm below 80%", () => {
    expect(savedLine(100, 100)).toContain("protein goal for today");
    expect(savedLine(90, 100)).toContain("close to your protein goal");
    expect(savedLine(80, 100)).toBe("Good progress on protein today.");
    expect(savedLine(40, 100)).toBe("Logged. Nice work keeping track.");
  });
});

describe("weekLines", () => {
  const empty = Array.from({ length: 7 }, () => ({ meal_count: 0, protein_g: 0 }));

  it("invites a first log when nothing is logged", () => {
    expect(weekLines(empty, 100)).toEqual(["Log a meal and your week will show up here."]);
  });

  it("counts logged days and each protein tier, without calories or rankings", () => {
    const week = [
      { meal_count: 2, protein_g: 100 }, // amazing
      { meal_count: 1, protein_g: 40 }, // below 80%, not counted as a tier
      { meal_count: 0, protein_g: 0 },
      { meal_count: 3, protein_g: 92 }, // great
      { meal_count: 2, protein_g: 85 }, // good
      { meal_count: 1, protein_g: 20 },
      { meal_count: 1, protein_g: 100 }, // amazing
    ];
    expect(weekLines(week, 100)).toEqual([
      "You logged on 6 of 7 days.",
      "Amazing: you reached your protein goal on 2 days.",
      "Great: you were close to your protein goal on 1 day.",
      "Good: you made solid protein progress on 1 day.",
    ]);
  });
});
