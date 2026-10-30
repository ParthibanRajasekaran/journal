// Encouragement for the user's healthy habits: logging, and reaching a protein goal.
// Calories are never celebrated, and no message judges what the user ate.

export const APPROXIMATE = "Approximate, based on what you've entered.";

export function proteinGoalReached(protein: number, target: number | null): boolean {
  return target !== null && target > 0 && protein >= target;
}

// The line shown after a meal is saved.
export function savedLine(protein: number, target: number | null): string {
  return proteinGoalReached(protein, target)
    ? "Logged. You've reached your protein goal for today."
    : "Logged. Nice work keeping track.";
}

// The Week summary. It counts days logged and protein goals reached, and never ranks or compares.
export function weekLines(days: { meal_count: number; protein_g: number }[], target: number | null): string[] {
  const logged = days.filter((d) => d.meal_count > 0).length;
  if (logged === 0) return ["Log a meal and your week will show up here."];

  const lines = [`You logged on ${logged} of ${days.length} days.`];
  const reached = days.filter((d) => proteinGoalReached(d.protein_g, target)).length;
  if (reached > 0) {
    lines.push(`You reached your protein goal on ${reached} ${reached === 1 ? "day" : "days"}.`);
  }
  return lines;
}
