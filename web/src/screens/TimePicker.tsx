import { useState } from "react";
import { Meal } from "../api";

// One choice does two jobs: picking "Lunch" sets the meal type and its usual time.
const MEALS: { type: Meal["meal_type"]; label: string; time: string }[] = [
  { type: "breakfast", label: "Breakfast", time: "08:00" },
  { type: "lunch", label: "Lunch", time: "13:00" },
  { type: "snack", label: "Snack", time: "16:30" },
  { type: "dinner", label: "Dinner", time: "19:30" },
];

export function defaultMealFor(now: Date = new Date()): Meal["meal_type"] {
  const hour = now.getHours();
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snack";
  return "dinner";
}

export function usualTime(type: Meal["meal_type"]): string {
  return MEALS.find((m) => m.type === type)!.time;
}

interface Props {
  mealType: Meal["meal_type"];
  time: string;
  onChange: (choice: { mealType: Meal["meal_type"]; time: string }) => void;
}

export function MealTimePicker({ mealType, time, onChange }: Props) {
  const [showTime, setShowTime] = useState(!MEALS.some((m) => m.time === time && m.type === mealType));

  return (
    <div className="time-picker">
      <span className="label-text">Which meal?</span>
      <div className="chips" role="radiogroup" aria-label="Meal">
        {MEALS.map((m) => {
          const on = m.type === mealType;
          return (
            <button
              key={m.type}
              type="button"
              role="radio"
              aria-checked={on}
              className={`chip ${on ? "chip-on" : ""}`}
              onClick={() => {
                setShowTime(false);
                onChange({ mealType: m.type, time: m.time });
              }}
            >
              <span>{m.label}</span>
              <small>{m.time}</small>
            </button>
          );
        })}
      </div>
      {showTime ? (
        <label className="other-time">
          <span>Time</span>
          <input type="time" value={time} onChange={(e) => onChange({ mealType, time: e.target.value })} />
        </label>
      ) : (
        <button type="button" className="ghost other-link" onClick={() => setShowTime(true)}>
          Different time?
        </button>
      )}
    </div>
  );
}
