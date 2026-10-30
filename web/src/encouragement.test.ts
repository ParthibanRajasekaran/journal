import { describe, expect, it } from "vitest";
import { proteinGoalReached, savedLine, weekLines } from "./encouragement";

describe("proteinGoalReached", () => {
  it("is true at or above the goal, and false without a goal", () => {
    expect(proteinGoalReached(120, 120)).toBe(true);
    expect(proteinGoalReached(130, 120)).toBe(true);
    expect(proteinGoalReached(60, 120)).toBe(false);
    expect(proteinGoalReached(200, null)).toBe(false);
  });
});

describe("savedLine", () => {
  it("names the protein goal only when it is reached", () => {
    expect(savedLine(120, 120)).toContain("protein goal");
    expect(savedLine(10, 120)).toBe("Logged. Nice work keeping track.");
  });
});

describe("weekLines", () => {
  const empty = Array.from({ length: 7 }, () => ({ meal_count: 0, protein_g: 0 }));

  it("invites a first log when nothing is logged", () => {
    expect(weekLines(empty, 120)).toEqual(["Log a meal and your week will show up here."]);
  });

  it("counts logged days and protein goals reached, without calories", () => {
    const week = [
      { meal_count: 2, protein_g: 130 },
      { meal_count: 1, protein_g: 40 },
      { meal_count: 0, protein_g: 0 },
      { meal_count: 3, protein_g: 125 },
      ...empty.slice(4),
    ];
    expect(weekLines(week, 120)).toEqual([
      "You logged on 3 of 7 days.",
      "You reached your protein goal on 2 days.",
    ]);
  });
});
