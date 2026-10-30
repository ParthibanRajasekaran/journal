import { FormEvent, useState } from "react";
import { api, ApiError, Meal } from "../api";

interface Props {
  meal: Meal;
  onCancel: () => void;
  onSaved: () => void;
}

const LIMITS = { calories: [0, 5000], protein_g: [0, 300], carbs_g: [0, 500], fat_g: [0, 300] } as const;

// Editing sends the version we last read. If someone else changed the meal first, the server
// answers 412 and we ask the user to reload, rather than overwriting their change.
export function EditMeal({ meal, onCancel, onSaved }: Props) {
  const [name, setName] = useState(meal.name);
  const [mealType, setMealType] = useState<Meal["meal_type"]>(meal.meal_type);
  const [values, setValues] = useState({
    calories: String(Math.round(meal.calories)),
    protein_g: String(Math.round(meal.protein_g)),
    carbs_g: String(Math.round(meal.carbs_g)),
    fat_g: String(Math.round(meal.fat_g)),
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function problem(): string | null {
    if (name.trim().length === 0) return "Give the meal a name.";
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
    try {
      await api.updateMeal(meal, {
        name: name.trim(),
        meal_type: mealType,
        calories: Number(values.calories),
        protein_g: Number(values.protein_g),
        carbs_g: Number(values.carbs_g),
        fat_g: Number(values.fat_g),
      });
      onSaved();
    } catch (err) {
      const e = err as ApiError;
      setError(e.status === 412 ? "This meal changed elsewhere. Reload and try again." : e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate style={{ width: "100%" }}>
      <label htmlFor={`edit-name-${meal.id}`}>Name</label>
      <input id={`edit-name-${meal.id}`} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      <label htmlFor={`edit-type-${meal.id}`}>Meal</label>
      <select id={`edit-type-${meal.id}`} value={mealType} onChange={(e) => setMealType(e.target.value as Meal["meal_type"])}>
        <option value="breakfast">Breakfast</option>
        <option value="lunch">Lunch</option>
        <option value="dinner">Dinner</option>
        <option value="snack">Snack</option>
      </select>
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
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row" style={{ marginTop: 12, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
  );
}
