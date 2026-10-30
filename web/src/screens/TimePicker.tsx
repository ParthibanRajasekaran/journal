import { Meal } from "../api";

// Quick shortcuts for the usual times. The default is the current time, so these are optional.
const SHORTCUTS: { type: Meal["meal_type"]; label: string; time: string }[] = [
  { type: "breakfast", label: "Breakfast", time: "08:00" },
  { type: "lunch", label: "Lunch", time: "13:00" },
  { type: "snack", label: "Snack", time: "16:30" },
  { type: "dinner", label: "Dinner", time: "19:30" },
];

const pad = (n: number) => String(n).padStart(2, "0");

// The current time, rounded to the nearest 5 minutes, as HH:MM in the user's zone.
export function nowRounded(now: Date = new Date()): string {
  const date = new Date(now);
  date.setMinutes(Math.round(date.getMinutes() / 5) * 5, 0, 0); // setMinutes carries 60 into the hour
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// The meal a time of day usually belongs to. The user can change it with one tap.
export function mealFor(time: string): Meal["meal_type"] {
  const hour = Number(time.slice(0, 2));
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snack";
  return "dinner";
}

interface Props {
  mealType: Meal["meal_type"];
  time: string;
  onChange: (choice: { mealType: Meal["meal_type"]; time: string }) => void;
}

// The time is always visible and editable. Changing it suggests the meal; a shortcut sets both.
export function MealTimePicker({ mealType, time, onChange }: Props) {
  return (
    <div className="time-picker">
      <label className="other-time">
        <span>Time</span>
        <input
          type="time"
          value={time}
          onChange={(e) => {
            if (e.target.value === "") return;
            onChange({ mealType: mealFor(e.target.value), time: e.target.value });
          }}
        />
      </label>
      <span className="label-text">Meal</span>
      <div className="chips" role="radiogroup" aria-label="Meal">
        {SHORTCUTS.map((m) => {
          const on = m.type === mealType;
          return (
            <button
              key={m.type}
              type="button"
              role="radio"
              aria-checked={on}
              className={`chip ${on ? "chip-on" : ""}`}
              onClick={() => onChange({ mealType: m.type, time: m.time })}
            >
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
