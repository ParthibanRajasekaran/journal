import { useEffect, useState } from "react";
import { api, Totals } from "../api";
import { addDays, formatDay, mondayOf, utcDay } from "../dates";

interface Props {
  onOpenDay: (day: string) => void;
}

export function Week({ onOpenDay }: Props) {
  const [start, setStart] = useState(() => mondayOf(utcDay()));
  const [days, setDays] = useState<Totals[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api
      .week(start)
      .then(setDays)
      .catch((err: Error) => setError(err.message));
  }, [start]);

  return (
    <>
      <div className="row">
        <button onClick={() => setStart(addDays(start, -7))} aria-label="Previous week">‹</button>
        <h1 style={{ fontSize: 18, textAlign: "center" }}>Week of {formatDay(start)}</h1>
        <button onClick={() => setStart(addDays(start, 7))} aria-label="Next week">›</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
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
