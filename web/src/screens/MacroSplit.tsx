import { APPROXIMATE } from "../encouragement";

interface Totals {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

// Energy from each macro: protein and carbohydrate are 4 kcal per gram, fat is 9 kcal per gram.
// It is worked out only from what the user entered, so it is a tracker, not a judgement.
export function macroShares(totals: Totals): { protein: number; carbs: number; fat: number } | null {
  const protein = totals.protein_g * 4;
  const carbs = totals.carbs_g * 4;
  const fat = totals.fat_g * 9;
  const all = protein + carbs + fat;
  if (all <= 0) return null;
  return { protein: protein / all, carbs: carbs / all, fat: fat / all };
}

export function MacroSplit({ totals }: { totals: Totals }) {
  const shares = macroShares(totals);
  if (!shares) {
    return <p className="muted macro-empty">Your split of protein, carbs and fat will appear here once you log a meal.</p>;
  }
  const rows = [
    { key: "protein", label: "Protein", grams: totals.protein_g, share: shares.protein },
    { key: "carbs", label: "Carbs", grams: totals.carbs_g, share: shares.carbs },
    { key: "fat", label: "Fat", grams: totals.fat_g, share: shares.fat },
  ];
  return (
    <section className="card macro-split" aria-label="Protein, carbs and fat for the day">
      <h2 style={{ marginTop: 0 }}>Your split</h2>
      <div className="split-bar" role="img" aria-label={rows.map((r) => `${r.label} ${Math.round(r.share * 100)} percent`).join(", ")}>
        {rows.map((r) => (
          <span key={r.key} className={`split-${r.key}`} style={{ width: `${(r.share * 100).toFixed(1)}%` }} />
        ))}
      </div>
      <ul className="split-legend">
        {rows.map((r) => (
          <li key={r.key}>
            <span className={`split-dot split-${r.key}`} aria-hidden="true" />
            <span>{r.label}</span>
            <span className="num muted">
              {Math.round(r.grams)} g · {Math.round(r.share * 100)}%
            </span>
          </li>
        ))}
      </ul>
      <p className="fine-print muted">{APPROXIMATE}</p>
    </section>
  );
}
