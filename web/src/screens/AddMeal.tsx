import { FormEvent, useState } from "react";
import { api, ApiError, Meal } from "../api";
import { utcDay } from "../dates";

interface Props {
  day: string;
  onDone: () => void;
  onCancel: () => void;
}

// Matches the API's limits, so the form reports problems before the server does.
const LIMITS = { calories: [0, 5000], protein_g: [0, 300], carbs_g: [0, 500], fat_g: [0, 300] } as const;

export function AddMeal({ day, onDone, onCancel }: Props) {
  const [name, setName] = useState("");
  const [mealType, setMealType] = useState<Meal["meal_type"]>("lunch");
  const [time, setTime] = useState(() => new Date().toISOString().slice(11, 16));
  const [values, setValues] = useState({ calories: "", protein_g: "", carbs_g: "", fat_g: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [describing, setDescribing] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [estimateNote, setEstimateNote] = useState<string | null>(null);

  async function estimate() {
    setError(null);
    setEstimateNote(null);
    if (describing.trim().length < 3) return setError("Describe what you ate first.");
    setEstimating(true);
    try {
      const result = await api.estimate(describing.trim());
      const e = result.estimate;
      setName((current) => (current.trim() ? current : e.name));
      setValues({
        calories: String(Math.round(e.calories)),
        protein_g: String(Math.round(e.protein_g)),
        carbs_g: String(Math.round(e.carbs_g)),
        fat_g: String(Math.round(e.fat_g)),
      });
      setEstimateNote(
        `Estimated with your ${result.provider === "openai" ? "OpenAI" : result.provider === "anthropic" ? "Claude" : "Gemini"} key. Check the numbers, then save.`,
      );
    } catch (err) {
      const e = err as ApiError;
      setError(e.status === 409 ? "Add your AI key in Settings to estimate meals." : e.message);
    } finally {
      setEstimating(false);
    }
  }

  function problem(): string | null {
    if (name.trim().length === 0) return "Give the meal a name.";
    if (name.length > 120) return "The name is too long.";
    for (const [field, [min, max]] of Object.entries(LIMITS)) {
      const raw = values[field as keyof typeof values];
      if (raw === "") return `Enter ${field.replace("_g", "").replace("_", " ")}.`;
      const number = Number(raw);
      if (Number.isNaN(number) || number < min || number > max) return `${field.replace("_g", "")} must be between ${min} and ${max}.`;
    }
    return null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const failure = problem();
    if (failure) return setError(failure);
    setError(null);
    setSaving(true);
    try {
      await api.createMeal({
        client_id: crypto.randomUUID(),
        meal_type: mealType,
        eaten_at: new Date(`${day}T${time}:00Z`).toISOString(),
        name: name.trim(),
        calories: Number(values.calories),
        protein_g: Number(values.protein_g),
        carbs_g: Number(values.carbs_g),
        fat_g: Number(values.fat_g),
        source: "manual",
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="card add-form">
      <h1>Add meal{day !== utcDay() ? ` for ${day}` : ""}</h1>

      <div className="estimate-box">
        <label htmlFor="describe">Describe it, and we'll work out the numbers</label>
        <div className="estimate-row">
          <textarea
            id="describe"
            rows={2}
            value={describing}
            onChange={(e) => setDescribing(e.target.value)}
            placeholder="e.g. 4 poori with 5 spoons of paneer butter masala"
          />
          <button type="button" className="primary" onClick={estimate} disabled={estimating}>
            {estimating ? "Working…" : "Estimate"}
          </button>
        </div>
        {estimateNote && <p className="muted" role="status">{estimateNote}</p>}
      </div>

      <div className="form-grid">
      <div className="span-2">
      <label htmlFor="name">What did you eat?</label>
      <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="off" />
      </div>

      <div>
      <label htmlFor="type">Meal</label>
      <select id="type" value={mealType} onChange={(e) => setMealType(e.target.value as Meal["meal_type"])}>
        <option value="breakfast">Breakfast</option>
        <option value="lunch">Lunch</option>
        <option value="dinner">Dinner</option>
        <option value="snack">Snack</option>
      </select>

      </div>
      <div>
      <label htmlFor="time">Time (UTC)</label>
      <input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      </div>

      <div className="macro-grid">
        {(Object.keys(LIMITS) as (keyof typeof LIMITS)[]).map((field) => (
          <div key={field} style={{ flex: 1 }}>
            <label htmlFor={field}>{field === "calories" ? "Calories (kcal)" : field.replace("_g", "") + " (g)"}</label>
            <input
              id={field}
              inputMode="decimal"
              value={values[field]}
              onChange={(e) => setValues({ ...values, [field]: e.target.value })}
            />
          </div>
        ))}
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : "Save meal"}</button>
      </div>
      <p className="muted">Enter the numbers from the label or your own estimate. Estimates from photos come later.</p>
    </form>
  );
}
