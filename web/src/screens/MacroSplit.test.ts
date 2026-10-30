import { describe, expect, it } from "vitest";
import { macroShares } from "./MacroSplit";

describe("macroShares", () => {
  it("weights protein and carbs at 4 kcal per gram and fat at 9", () => {
    const shares = macroShares({ protein_g: 25, carbs_g: 50, fat_g: 10 });
    // 100 kcal protein, 200 kcal carbs, 90 kcal fat: 290 kcal in total
    expect(shares?.protein).toBeCloseTo(100 / 390, 6);
    expect(shares?.carbs).toBeCloseTo(200 / 390, 6);
    expect(shares?.fat).toBeCloseTo(90 / 390, 6);
  });

  it("returns null when nothing has been logged", () => {
    expect(macroShares({ protein_g: 0, carbs_g: 0, fat_g: 0 })).toBeNull();
  });
});
