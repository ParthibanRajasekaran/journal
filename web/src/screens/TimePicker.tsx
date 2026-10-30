import { Meal } from "../api";

// The time a meal gets when the user picks it and the current time is outside its window.
const DEFAULT_TIME: Record<Exclude<Meal["meal_type"], "other">, string> = {
  breakfast: "08:00",
  lunch: "13:00",
  snack: "16:30",
  dinner: "19:30",
};

const MEALS: { type: Meal["meal_type"]; label: string }[] = [
  { type: "breakfast", label: "Breakfast" },
  { type: "lunch", label: "Lunch" },
  { type: "snack", label: "Snack" },
  { type: "dinner", label: "Dinner" },
  { type: "other", label: "Other" },
];

const pad = (n: number) => String(n).padStart(2, "0");

// The current time, rounded to the nearest 5 minutes, as HH:MM in the user's zone.
export function nowRounded(now: Date = new Date()): string {
  const date = new Date(now);
  date.setMinutes(Math.round(date.getMinutes() / 5) * 5, 0, 0); // setMinutes carries 60 into the hour
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// The meal a time of day usually belongs to.
export function mealFor(time: string): Meal["meal_type"] {
  const hour = Number(time.slice(0, 2));
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 18) return "snack";
  return "dinner";
}

// Time is the single source of truth. Picking a meal keeps the time if it already falls in that
// meal's window, so a choice never overwrites a time the user just typed.
// Drinks and other intake keep whatever time the user set, since they are not tied to a meal time.
export function timeFor(meal: Meal["meal_type"], current: string): string {
  if (meal === "other") return current;
  return mealFor(current) === meal ? current : DEFAULT_TIME[meal];
}

interface Props {
  mealType: Meal["meal_type"];
  time: string;
  onChange: (choice: { mealType: Meal["meal_type"]; time: string }) => void;
}

export function MealTimePicker({ mealType, time, onChange }: Props) {
  return (
    <fieldset className="when">
      <legend>When</legend>
      <label className="when-time">
        <span>Time</span>
        <input
          type="time"
          value={time}
          onChange={(e) => {
            if (e.target.value === "") return;
            // A typed time moves the meal, unless the user chose drinks and other.
            onChange({ mealType: mealType === "other" ? "other" : mealFor(e.target.value), time: e.target.value });
          }}
        />
      </label>
      <div className="segments">
        {MEALS.map((m) => {
          const on = m.type === mealType;
          return (
            <label key={m.type} className={`segment ${on ? "segment-on" : ""}`}>
              <input
                type="radio"
                name="meal"
                value={m.type}
                checked={on}
                onChange={() => onChange({ mealType: m.type, time: timeFor(m.type, time) })}
              />
              <span>{m.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
