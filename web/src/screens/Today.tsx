import { CSSProperties, useCallback, useEffect, useState } from "react";
import { api, DaySummary, Meal } from "../api";
import { EditMeal } from "./EditMeal";
import { MacroSplit } from "./MacroSplit";
import { addDays, formatDay, localDay, timeOf, userTz } from "../dates";
import { savedLine } from "../encouragement";

const MEAL_ORDER: Meal["meal_type"][] = ["breakfast", "lunch", "dinner", "snack"];

interface Props {
  day: string;
  onDayChange: (day: string) => void;
  onAdd: () => void;
  // True when the user has just saved a meal and came back here.
  savedNote: boolean;
}

// A small, warm acknowledgement after each save. It is chosen once per visit to Today.
const SAVED_ICONS = ["👍", "👏", "💚"];

export function Today({ day, onDayChange, onAdd, savedNote }: Props) {
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(savedNote);
  const [savedIcon] = useState(() => SAVED_ICONS[Math.floor(Math.random() * SAVED_ICONS.length)]);

  // The confirmation fades on its own, and a tap dismisses it.
  useEffect(() => {
    if (!showSaved || !summary) return;
    const timer = setTimeout(() => setShowSaved(false), 3500);
    return () => clearTimeout(timer);
  }, [showSaved, summary]);

  const load = useCallback(() => {
    setError(null);
    api
      .day(day, userTz)
      .then(setSummary)
      .catch((err: Error) => setError(err.message));
  }, [day]);

  useEffect(load, [load]);

  async function remove(meal: Meal) {
    setConfirming(null);
    try {
      await api.deleteMeal(meal.id);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const isToday = day === localDay();
  const hasMeals = summary !== null && summary.meals.length > 0;
  return (
    <>
      <div className="row" style={{ marginBottom: 6 }}>
        <button className="ghost icon-btn" onClick={() => onDayChange(addDays(day, -1))} aria-label="Previous day">‹</button>
        <h1 style={{ margin: 0, fontSize: 18, textAlign: "center" }}>{isToday ? "Today" : formatDay(day)}</h1>
        <button className="ghost icon-btn" onClick={() => onDayChange(addDays(day, 1))} aria-label="Next day" disabled={isToday}>›</button>
      </div>

      {error && summary && <p className="error" role="alert">{error}</p>}

      {showSaved && summary && (
        <p className="saved-note" role="status" onClick={() => setShowSaved(false)}>
          <span className="check" aria-hidden="true">{savedIcon}</span>
          {savedLine(summary.protein_g, summary.targets.protein_g)}
        </p>
      )}

      {summary ? (
        <div className="today-grid">
          <section>
            <SummaryCard summary={summary} />
            <MacroSplit totals={summary} />
            <button className="primary add-inline" style={{ width: "100%", marginBottom: 14 }} onClick={onAdd}>Add meal</button>
          </section>
          <section>
            {!hasMeals ? (
              <div className="card empty-day">
                <p>Nothing logged for this day yet.</p>
                <button className="primary" onClick={onAdd}>Add your first meal</button>
              </div>
            ) : (
              MEAL_ORDER.map((type) => {
                const meals = summary.meals.filter((m) => m.meal_type === type);
                return (
                  <div key={type}>
                    <h2>{type}</h2>
                    {meals.length === 0 ? (
                      <p className="muted" style={{ margin: "0 0 8px" }}>Nothing logged yet.</p>
                    ) : (
                      <ul className="meal-group">
                        {meals.map((meal) => (
                          <li key={meal.id} className="meal-item">
                            {editing === meal.id ? (
                              <EditMeal
                                meal={meal}
                                onCancel={() => setEditing(null)}
                                onSaved={() => {
                                  setEditing(null);
                                  load();
                                }}
                                onStale={() => {
                                  setEditing(null);
                                  load();
                                }}
                              />
                            ) : confirming === meal.id ? (
                              <div className="meal-confirm" role="alert">
                                <p>Delete {meal.name}? This can't be undone.</p>
                                <span className="meal-actions">
                                  <button onClick={() => setConfirming(null)} autoFocus>Keep it</button>
                                  <button className="danger-solid" onClick={() => remove(meal)}>Delete</button>
                                </span>
                              </div>
                            ) : (
                              <>
                                <span>
                                  <strong>{meal.name}</strong>
                                  <span className="muted"> · {timeOf(meal.eaten_at)} · <span className="num">{Math.round(meal.calories)}</span> kcal</span>
                                  <span className="muted num" style={{ display: "block", fontSize: 13 }}>
                                    P {Math.round(meal.protein_g)} g · C {Math.round(meal.carbs_g)} g · F {Math.round(meal.fat_g)} g
                                  </span>
                                </span>
                                <span className="meal-actions">
                                  <button className="ghost" onClick={() => setEditing(meal.id)} aria-label={`Edit ${meal.name}`}>Edit</button>
                                  <button className="ghost" onClick={() => setConfirming(meal.id)} aria-label={`Delete ${meal.name}`}>Delete</button>
                                </span>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </section>
        </div>
      ) : error ? (
        <section className="card load-error" role="alert">
          <p>Couldn't load this day. {error}</p>
          <button className="primary" onClick={load}>Try again</button>
        </section>
      ) : (
        <div className="skeleton" aria-label="Loading day" />
      )}
    </>
  );
}

function SummaryCard({ summary }: { summary: DaySummary }) {
  const target = summary.targets.calories;
  const left = target === null ? null : Math.round(target - summary.calories);
  const over = left !== null && left < 0;
  const pct = target ? Math.min(100, (summary.calories / target) * 100) : 0;
  return (
    <section className="card hero" aria-label="Day summary">
      <div
        className={`ring ${over ? "over" : ""}`}
        style={{ "--p": pct } as CSSProperties}
        role="img"
        aria-label={left === null ? `${Math.round(summary.calories)} kcal eaten` : `${Math.abs(left)} kcal ${over ? "over" : "left"}`}
      >
        <div>
          <div className="big">{left === null ? Math.round(summary.calories) : Math.abs(left)}</div>
          <div className="small">{left === null ? "kcal eaten" : over ? "kcal over" : "kcal left"}</div>
        </div>
      </div>
      <div style={{ width: "100%" }}>
        <div className="muted num">{Math.round(summary.calories)} of {target ?? "–"} kcal</div>
        {summary.targets.protein_g !== null && (
          <>
            <div className="muted num" style={{ marginTop: 14 }}>Protein {Math.round(summary.protein_g)} of {summary.targets.protein_g} g</div>
            <Bar value={summary.protein_g} goal={summary.targets.protein_g} />
          </>
        )}
        {target === null && <p className="muted">Set daily targets in Settings to see what's left.</p>}
      </div>
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
