import { FormEvent, useState } from "react";
import { api, ApiError, Meal } from "../api";
import { dayAndTime, momentOf } from "../dates";

interface Props {
  meal: Meal;
  onCancel: () => void;
  onSaved: () => void;
  // Called when the meal changed elsewhere. The parent reloads the day and closes this form.
  onStale: () => void;
}

const LIMITS = { calories: [0, 5000], protein_g: [0, 300], carbs_g: [0, 500], fat_g: [0, 300] } as const;

// Editing sends the version we last read. If someone else changed the meal first, the server
// answers 412 and we ask the user to reload, rather than overwriting their change.
export function EditMeal({ meal, onCancel, onSaved, onStale }: Props) {
  const initial = dayAndTime(meal.eaten_at);
  const [name, setName] = useState(meal.name);
  const [mealType, setMealType] = useState<Meal["meal_type"]>(meal.meal_type);
  const [day, setDay] = useState(initial.day);
  const [time, setTime] = useState(initial.time);
  const [values, setValues] = useState({
    calories: String(Math.round(meal.calories)),
    protein_g: String(Math.round(meal.protein_g)),
    carbs_g: String(Math.round(meal.carbs_g)),
    fat_g: String(Math.round(meal.fat_g)),
  });
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const dirty =
    name !== meal.name ||
    mealType !== meal.meal_type ||
    day !== initial.day ||
    time !== initial.time ||
    Object.entries(values).some(
      ([field, value]) => value !== String(Math.round(meal[field as keyof typeof LIMITS])),
    );

  function problem(): string | null {
    if (name.trim().length === 0) return "Give the meal a name.";
    if (!day || !time) return "Choose the day and time.";
    for (const [field, [min, max]] of Object.entries(LIMITS)) {
      const raw = values[field as keyof typeof values];
      const number = Number(raw);
      if (raw === "" || Number.isNaN(number) || number < min || number > max) {
        return `${field.replace("_g", "")} must be between ${min} and ${max}.`;
      }
    }
    return null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const failure = problem();
    if (failure) return setError(failure);
    setSaving(true);
    setError(null);
    setStale(false);
    try {
      await api.updateMeal(meal, {
        name: name.trim(),
        meal_type: mealType,
        eaten_at: momentOf(day, time),
        calories: Number(values.calories),
        protein_g: Number(values.protein_g),
        carbs_g: Number(values.carbs_g),
        fat_g: Number(values.fat_g),
      });
      onSaved();
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 412) setStale(true);
      else setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (dirty) setConfirmCancel(true);
    else onCancel();
  }

  return (
    <form onSubmit={submit} noValidate style={{ width: "100%" }}>
      <label htmlFor={`edit-name-${meal.id}`}>Name</label>
      <input id={`edit-name-${meal.id}`} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      <div className="macro-grid">
        <div>
          <label htmlFor={`edit-type-${meal.id}`}>Meal</label>
          <select id={`edit-type-${meal.id}`} value={mealType} onChange={(e) => setMealType(e.target.value as Meal["meal_type"])}>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
        </div>
        <div>
          <label htmlFor={`edit-day-${meal.id}`}>Day</label>
          <input id={`edit-day-${meal.id}`} type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`edit-time-${meal.id}`}>Time</label>
          <input id={`edit-time-${meal.id}`} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <div className="macro-grid">
        {(Object.keys(LIMITS) as (keyof typeof LIMITS)[]).map((field) => (
          <div key={field}>
            <label htmlFor={`edit-${field}-${meal.id}`}>{field === "calories" ? "kcal" : field.replace("_g", "") + " g"}</label>
            <input
              id={`edit-${field}-${meal.id}`}
              inputMode="decimal"
              value={values[field]}
              onChange={(e) => setValues({ ...values, [field]: e.target.value })}
            />
          </div>
        ))}
      </div>
      {stale && (
        <div className="meal-confirm" role="alert" style={{ marginTop: 12 }}>
          <p>This meal changed somewhere else. Reload to see the latest version.</p>
          <button type="button" className="primary" onClick={onStale}>Reload</button>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {confirmCancel ? (
        <div className="meal-confirm" role="alert" style={{ marginTop: 12 }}>
          <p>Discard your changes?</p>
          <span className="meal-actions">
            <button type="button" onClick={() => setConfirmCancel(false)} autoFocus>Keep editing</button>
            <button type="button" className="danger-solid" onClick={onCancel}>Discard</button>
          </span>
        </div>
      ) : (
        <div className="form-actions">
          <button type="button" onClick={cancel}>Cancel</button>
          <button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      )}
    </form>
  );
}
