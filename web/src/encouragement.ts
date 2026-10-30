// Encouragement for healthy habits: logging, and reaching protein goals in tiers.
// Calories are never celebrated, and no message judges what the user ate or below 80%.

export const APPROXIMATE = "Approximate, based on what you've entered.";

export type ProteinTier = "amazing" | "great" | "good";

// Tiers are based on the user's own protein target: 80% is good, 90% is great, 100% is amazing.
// The tiers are never printed as percentages, and below 80% there is no message at all.
export function proteinTier(protein: number, target: number | null): ProteinTier | null {
  if (target === null || target <= 0) return null;
  const share = protein / target;
  if (share >= 1) return "amazing";
  if (share >= 0.9) return "great";
  if (share >= 0.8) return "good";
  return null;
}

// The line shown after a meal is saved.
export function savedLine(protein: number, target: number | null): string {
  switch (proteinTier(protein, target)) {
    case "amazing":
      return "Amazing! You've reached your protein goal for today.";
    case "great":
      return "Great! You're close to your protein goal.";
    case "good":
      return "Good progress on protein today.";
    default:
      return "Logged. Nice work keeping track.";
  }
}

// The Week summary. It counts days logged and days in each protein tier. It never ranks days.
export function weekLines(days: { meal_count: number; protein_g: number }[], target: number | null): string[] {
  const logged = days.filter((d) => d.meal_count > 0).length;
  if (logged === 0) return ["Log a meal and your week will show up here."];

  const count = (tier: ProteinTier) => days.filter((d) => proteinTier(d.protein_g, target) === tier).length;
  const amazing = count("amazing");
  const great = count("great");
  const good = count("good");

  const lines = [`You logged on ${logged} of ${days.length} days.`];
  if (amazing > 0) lines.push(`Amazing: you reached your protein goal on ${amazing} ${amazing === 1 ? "day" : "days"}.`);
  if (great > 0) lines.push(`Great: you were close to your protein goal on ${great} ${great === 1 ? "day" : "days"}.`);
  if (good > 0) lines.push(`Good: you made solid protein progress on ${good} ${good === 1 ? "day" : "days"}.`);
  return lines;
}
