import { useCallback, useEffect, useState } from "react";
import { api, DaySummary, Meal } from "../api";
import { addDays, formatDay, timeOf, utcDay } from "../dates";

const MEAL_ORDER: Meal["meal_type"][] = ["breakfast", "lunch", "dinner", "snack"];

interface Props {
  day: string;
  onDayChange: (day: string) => void;
  onAdd: () => void;
}

export function Today({ day, onDayChange, onAdd }: Props) {
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .day(day)
      .then(setSummary)
      .catch((err: Error) => setError(err.message));
  }, [day]);

  useEffect(load, [load]);

  async function remove(meal: Meal) {
    try {
      await api.deleteMeal(meal.id);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const isToday = day === utcDay();
  return (
    <>
      <div className="row">
        <button onClick={() => onDayChange(addDays(day, -1))} aria-label="Previous day">‹</button>
        <h1 style={{ fontSize: 18, textAlign: "center" }}>{isToday ? "Today" : formatDay(day)}</h1>
        <button onClick={() => onDayChange(addDays(day, 1))} aria-label="Next day" disabled={isToday}>›</button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {summary && <SummaryCard summary={summary} />}

      {summary &&
        MEAL_ORDER.map((type) => {
          const meals = summary.meals.filter((m) => m.meal_type === type);
          return (
            <section key={type}>
              <h2 style={{ textTransform: "capitalize" }}>{type}</h2>
              {meals.length === 0 ? (
                <p className="muted">Nothing logged.</p>
              ) : (
                <ul className="plain card">
                  {meals.map((meal) => (
                    <li key={meal.id} className="row">
                      <span>
                        <strong>{meal.name}</strong>
                        <span className="muted"> · {timeOf(meal.eaten_at)} · {Math.round(meal.calories)} kcal</span>
                      </span>
                      <button className="danger" onClick={() => remove(meal)} aria-label={`Delete ${meal.name}`}>Delete</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

      <button className="primary" style={{ width: "100%", marginTop: 12 }} onClick={onAdd}>Add meal</button>
    </>
  );
}

function SummaryCard({ summary }: { summary: DaySummary }) {
  const target = summary.targets.calories;
  const remaining = target === null ? null : Math.round(target - summary.calories);
  return (
    <section className="card" aria-label="Day summary">
      <div className="row">
        <div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{Math.round(summary.calories)}</div>
          <div className="muted">kcal eaten{target !== null ? ` of ${target}` : ""}</div>
        </div>
        {remaining !== null && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{remaining >= 0 ? remaining : 0}</div>
            <div className="muted">{remaining >= 0 ? "kcal left" : "kcal over"}</div>
          </div>
        )}
      </div>
      {target !== null && <Bar value={summary.calories} goal={target} />}
      {summary.targets.protein_g !== null && (
        <>
          <div className="muted">Protein {Math.round(summary.protein_g)} g of {summary.targets.protein_g} g</div>
          <Bar value={summary.protein_g} goal={summary.targets.protein_g} />
        </>
      )}
      {summary.targets.calories === null && (
        <p className="muted">Set your daily targets in Settings to see what's left.</p>
      )}
    </section>
  );
}

function Bar({ value, goal }: { value: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemax={goal}>
      <span className={value > goal ? "over" : ""} style={{ width: `${pct}%` }} />
    </div>
  );
}
