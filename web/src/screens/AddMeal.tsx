import { FormEvent, useState } from "react";
import { api, ApiError, EstimateItem, EstimateQuestion, Meal, SuppliedAnswer } from "../api";
import { utcDay } from "../dates";
import { defaultMealFor, MealTimePicker, usualTime } from "./TimePicker";

interface Props {
  day: string;
  onDone: () => void;
  onCancel: () => void;
}

const LIMITS = { calories: [0, 5000], protein_g: [0, 300], carbs_g: [0, 500], fat_g: [0, 300] } as const;
const PROVIDER_NAME = { openai: "OpenAI", anthropic: "Claude", gemini: "Gemini" } as const;

export function AddMeal({ day, onDone, onCancel }: Props) {
  const [name, setName] = useState("");
  const [mealType, setMealType] = useState<Meal["meal_type"]>(() => defaultMealFor());
  const [time, setTime] = useState(() => usualTime(defaultMealFor()));
  const [values, setValues] = useState({ calories: "", protein_g: "", carbs_g: "", fat_g: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [describing, setDescribing] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [questions, setQuestions] = useState<EstimateQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  function applyEstimate(result: Awaited<ReturnType<typeof api.estimate>>) {
    if (result.status === "needs_answers") {
      setQuestions(result.questions);
      setAnswers({});
      return;
    }
    const e = result.estimate;
    setQuestions(null);
    setItems(e.items);
    setAssumptions(e.assumptions);
    setName((current) => (current.trim() ? current : e.name));
    setValues({
      calories: String(Math.round(e.calories)),
      protein_g: String(Math.round(e.protein_g)),
      carbs_g: String(Math.round(e.carbs_g)),
      fat_g: String(Math.round(e.fat_g)),
    });
    setNote(`Estimated with your ${PROVIDER_NAME[result.provider]} key. Check the numbers, then save.`);
  }

  async function estimate(withAnswers?: SuppliedAnswer[]) {
    setError(null);
    setNote(null);
    if (!withAnswers && describing.trim().length < 3) return setError("Describe what you ate first.");
    setEstimating(true);
    try {
      applyEstimate(await api.estimate(describing.trim(), withAnswers));
    } catch (err) {
      const e = err as ApiError;
      setError(e.status === 409 ? "Add your AI key in Settings to estimate meals." : e.message);
    } finally {
      setEstimating(false);
    }
  }

  function answerAll() {
    const supplied: SuppliedAnswer[] = (questions ?? []).map((q) => ({
      ...q,
      answer: answers[q.id] ?? "unsure",
    }));
    setQuestions(null);
    void estimate(supplied);
  }

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
    setError(null);
    setSaving(true);
    try {
      await api.createMeal({
        client_id: crypto.randomUUID(),
        meal_type: mealType,
        // The time is picked in the user's own time zone, then stored as an absolute instant.
        eaten_at: new Date(`${day}T${time}:00`).toISOString(),
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
          <button type="button" className="primary" onClick={() => estimate()} disabled={estimating}>
            {estimating ? "Working…" : "Estimate"}
          </button>
        </div>

        {questions && (
          <div className="questions" role="group" aria-label="A few quick questions">
            {questions.map((q) => (
              <fieldset key={q.id} className="question">
                <legend>{q.question}</legend>
                <div className="chips">
                  {[...q.options, "I don't know"].map((option) => {
                    const value = option === "I don't know" ? "unsure" : option;
                    const on = (answers[q.id] ?? "unsure") === value;
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={on}
                        className={`chip ${on ? "chip-on" : ""}`}
                        onClick={() => setAnswers({ ...answers, [q.id]: value })}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                <p className="muted" style={{ margin: "6px 0 0" }}>If you're not sure, choose "I don't know" and we'll use {q.default}.</p>
              </fieldset>
            ))}
            <button type="button" className="primary" onClick={answerAll} disabled={estimating}>Continue</button>
          </div>
        )}

        {note && <p className="muted" role="status">{note}</p>}
        {assumptions.length > 0 && (
          <ul className="assumptions">
            {assumptions.map((a) => <li key={a}>{a}</li>)}
          </ul>
        )}
        {items.length > 0 && (
          <ul className="items">
            {items.map((item) => (
              <li key={item.name}>
                <span>{item.name}</span>
                <span className="num muted">{Math.round(item.calories)} kcal</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="form-grid">
        <div className="span-2">
          <label htmlFor="name">What did you eat?</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="off" />
        </div>
        <div className="span-2">
          <MealTimePicker
            mealType={mealType}
            time={time}
            onChange={(choice) => {
              setMealType(choice.mealType);
              setTime(choice.time);
            }}
          />
        </div>
      </div>

      <div className="macro-grid">
        {(Object.keys(LIMITS) as (keyof typeof LIMITS)[]).map((field) => (
          <div key={field}>
            <label htmlFor={field}>{field === "calories" ? "Calories (kcal)" : field.replace("_g", "") + " (g)"}</label>
            <input id={field} inputMode="decimal" value={values[field]} onChange={(e) => setValues({ ...values, [field]: e.target.value })} />
          </div>
        ))}
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary" disabled={saving}>{saving ? "Saving…" : "Save meal"}</button>
      </div>
    </form>
  );
}
