import { useEffect, useState } from "react";
import { api, Totals } from "../api";
import { addDays, formatDay, localDay, mondayOf, userTz } from "../dates";
import { APPROXIMATE, weekLines } from "../encouragement";

interface Props {
  onOpenDay: (day: string) => void;
  proteinTarget: number | null;
}

export function Week({ onOpenDay, proteinTarget }: Props) {
  const [start, setStart] = useState(() => mondayOf(localDay()));
  const [days, setDays] = useState<Totals[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setError(null);
    api
      .week(start, userTz)
      .then(setDays)
      .catch((err: Error) => setError(err.message));
  }, [start, attempt]);

  return (
    <>
      <div className="row">
        <button className="ghost icon-btn" onClick={() => setStart(addDays(start, -7))} aria-label="Previous week">‹</button>
        <h1 style={{ fontSize: 18, textAlign: "center" }}>Week of {formatDay(start)}</h1>
        <button className="ghost icon-btn" onClick={() => setStart(addDays(start, 7))} aria-label="Next week">›</button>
      </div>
      {error && (
        <section className="card load-error" role="alert">
          <p>Couldn't load this week. {error}</p>
          <button className="primary" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </section>
      )}
      {days && (
        <section className="card encourage" aria-label="Your week">
          {weekLines(days, proteinTarget).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p className="fine-print muted">{APPROXIMATE}</p>
        </section>
      )}
      {days && (
        <ul className="week-grid" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {days.map((day) => (
            <li key={day.date} className="card" style={{ margin: 0, padding: 0 }}>
              <button className="day-tile" onClick={() => onOpenDay(day.date)}>
                <span className="date">{formatDay(day.date).split(" ").slice(0, 2).join(" ")}</span>
                <span className="muted" style={{ display: "block", marginTop: 6 }}>
                  {day.meal_count === 0 ? "No meals" : `${day.meal_count} meal${day.meal_count === 1 ? "" : "s"} · ${Math.round(day.calories)} kcal`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
