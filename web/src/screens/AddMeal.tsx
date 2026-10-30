import { FormEvent, useState } from "react";
import { api, ApiError, EstimateItem, EstimateQuestion, Meal, SuppliedAnswer } from "../api";
import { localDay } from "../dates";
import { defaultMealFor, MealTimePicker, usualTime } from "./TimePicker";

interface Props {
  day: string;
  onDone: () => void;
  onCancel: () => void;
}

const LIMITS = { calories: [0, 5000], protein_g: [0, 300], carbs_g: [0, 500], fat_g: [0, 300] } as const;
const PROVIDER_NAME = { openai: "OpenAI", anthropic: "Claude", gemini: "Gemini" } as const;
const MEAL_LABEL: Record<Meal["meal_type"], string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

type Values = { calories: string; protein_g: string; carbs_g: string; fat_g: string };

// One path: describe, check the estimate, save. Numbers are typed only when asked for.
export function AddMeal({ day, onDone, onCancel }: Props) {
  const [name, setName] = useState("");
  const [mealType, setMealType] = useState<Meal["meal_type"]>(() => defaultMealFor());
  const [time, setTime] = useState(() => usualTime(defaultMealFor()));
  const [pickingMeal, setPickingMeal] = useState(false);
  const [values, setValues] = useState<Values>({ calories: "", protein_g: "", carbs_g: "", fat_g: "" });
  const [manual, setManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [describing, setDescribing] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [questions, setQuestions] = useState<EstimateQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

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
    setProvider(result.provider);
    setName(e.name);
    setValues({
      calories: String(Math.round(e.calories)),
      protein_g: String(Math.round(e.protein_g)),
      carbs_g: String(Math.round(e.carbs_g)),
      fat_g: String(Math.round(e.fat_g)),
    });
  }

  async function estimate(withAnswers?: SuppliedAnswer[]) {
    setError(null);
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
    const supplied: SuppliedAnswer[] = (questions ?? []).map((q) => ({ ...q, answer: answers[q.id] ?? "unsure" }));
    setQuestions(null);
    void estimate(supplied);
  }

  function problem(): string | null {
    if (name.trim().length === 0) return "Describe the meal first, or enter a name.";
    for (const [field, [min, max]] of Object.entries(LIMITS)) {
      const raw = values[field as keyof Values];
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
        // Stored as an exact moment, from the time picked in the user's own time zone.
        eaten_at: new Date(`${day}T${time}:00`).toISOString(),
        name: name.trim(),
        calories: Number(values.calories),
        protein_g: Number(values.protein_g),
        carbs_g: Number(values.carbs_g),
        fat_g: Number(values.fat_g),
        source: provider ? "ai_confirmed" : "manual",
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const hasEstimate = provider !== null;
  const summary = `${MEAL_LABEL[mealType]} · ${time}`;

  return (
    <form onSubmit={submit} noValidate className="card add-form">
      <h1>Add meal{day !== localDay() ? ` for ${day}` : ""}</h1>

      <div className="estimate-box">
        <label htmlFor="describe">What did you eat?</label>
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
          <div className="questions" role="group" aria-label="One quick question">
            {questions.map((q) => (
              <fieldset key={q.id} className="question">
                <legend>{q.question}</legend>
                <div className="chips">
                  {[...q.options, "Not sure"].map((option) => {
                    const value = option === "Not sure" ? "unsure" : option;
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
                <p className="muted" style={{ margin: "6px 0 0" }}>Not sure? We'll assume {q.default}.</p>
              </fieldset>
            ))}
            <button type="button" className="primary" onClick={answerAll} disabled={estimating}>Continue</button>
          </div>
        )}

        {hasEstimate && (
          <div className="result" role="status">
            <div className="result-head">
              <input
                aria-label="Meal name"
                className="result-name"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="result-kcal num">
              <span className="big-kcal">{values.calories}</span>
              <span className="muted"> kcal</span>
            </div>
            <div className="macro-line num muted">
              Protein {values.protein_g} g · Carbs {values.carbs_g} g · Fat {values.fat_g} g
            </div>
            <button type="button" className="ghost other-link" onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}>
              {showDetails ? "Hide details" : "Show details"}
            </button>
            {showDetails && (
              <div>
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
                {assumptions.length > 0 && (
                  <ul className="assumptions">
                    {assumptions.map((a) => <li key={a}>{a}</li>)}
                  </ul>
                )}
                <p className="muted fine-print">Estimated with your {PROVIDER_NAME[provider as keyof typeof PROVIDER_NAME] ?? "AI"} key. Check it before saving.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="meal-line">
        {pickingMeal ? (
          <MealTimePicker
            mealType={mealType}
            time={time}
            onChange={(choice) => {
              setMealType(choice.mealType);
              setTime(choice.time);
            }}
          />
        ) : (
          <button type="button" className="ghost meal-summary" onClick={() => setPickingMeal(true)}>
            {summary} <span aria-hidden="true">▾</span>
            <span className="visually-hidden">Change meal and time</span>
          </button>
        )}
      </div>

      {(manual || (hasEstimate && showDetails)) && (
        <div className="macro-grid">
          {(Object.keys(LIMITS) as (keyof typeof LIMITS)[]).map((field) => (
            <div key={field}>
              <label htmlFor={field}>{field === "calories" ? "kcal" : field.replace("_g", "") + " g"}</label>
              <input id={field} inputMode="decimal" value={values[field]} onChange={(e) => setValues({ ...values, [field]: e.target.value })} />
            </div>
          ))}
        </div>
      )}

      {!hasEstimate && !manual && (
        <button type="button" className="ghost other-link" onClick={() => setManual(true)}>
          Enter the numbers myself
        </button>
      )}

      {manual && !hasEstimate && (
        <div className="manual-name">
          <label htmlFor="name">Name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="off" />
        </div>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary" disabled={saving || (!hasEstimate && !manual)}>
          {saving ? "Saving…" : "Save meal"}
        </button>
      </div>
    </form>
  );
}
