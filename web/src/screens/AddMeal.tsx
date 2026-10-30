import { FormEvent, useState } from "react";
import { api, ApiError, EstimateItem, EstimateQuestion, Meal, SuppliedAnswer } from "../api";
import { localDay, momentOf } from "../dates";
import { defaultMealFor, MealTimePicker, usualTime } from "./TimePicker";
import { KeyHelp } from "./KeyHelp";

interface Props {
  day: string;
  onDone: () => void;
  onCancel: () => void;
}

const LIMITS = { calories: [0, 5000], protein_g: [0, 300], carbs_g: [0, 500], fat_g: [0, 300] } as const;
const PROVIDER_NAME = { openai: "OpenAI", anthropic: "Claude", gemini: "Gemini" } as const;
const MEAL_LABEL: Record<Meal["meal_type"], string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

type Values = { calories: string; protein_g: string; carbs_g: string; fat_g: string };

// What the estimate said, so we can tell whether the user changed it before saving.
interface Estimated {
  name: string;
  values: Values;
}

const FIELD_LABEL: Record<keyof Values, string> = { calories: "kcal", protein_g: "protein g", carbs_g: "carbs g", fat_g: "fat g" };

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
  const [confirmCancel, setConfirmCancel] = useState(false);

  const [describing, setDescribing] = useState("");
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [questions, setQuestions] = useState<EstimateQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [items, setItems] = useState<EstimateItem[]>([]);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [estimated, setEstimated] = useState<Estimated | null>(null);
  const [announce, setAnnounce] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  function applyEstimate(result: Awaited<ReturnType<typeof api.estimate>>) {
    if (result.status === "needs_answers") {
      setQuestions(result.questions);
      setAnswers({});
      return;
    }
    const e = result.estimate;
    const next: Values = {
      calories: String(Math.round(e.calories)),
      protein_g: String(Math.round(e.protein_g)),
      carbs_g: String(Math.round(e.carbs_g)),
      fat_g: String(Math.round(e.fat_g)),
    };
    setQuestions(null);
    setItems(e.items);
    setAssumptions(e.assumptions);
    setProvider(result.provider);
    setName(e.name);
    setValues(next);
    setEstimated({ name: e.name, values: next });
    setAnnounce(`Estimate ready: ${next.calories} kcal.`);
  }

  async function estimate(withAnswers?: SuppliedAnswer[]) {
    setEstimateError(null);
    setNeedsKey(false);
    if (!withAnswers && describing.trim().length < 3) return setEstimateError("Describe what you ate first.");
    setEstimating(true);
    try {
      applyEstimate(await api.estimate(describing.trim(), withAnswers));
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 409) setNeedsKey(true);
      else setEstimateError(e.message);
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

  // Estimated and then changed by the user counts as edited; otherwise it is confirmed as is.
  function sourceFor(): "manual" | "ai_confirmed" | "ai_edited" {
    if (!estimated) return "manual";
    const changed =
      name.trim() !== estimated.name ||
      (Object.keys(LIMITS) as (keyof Values)[]).some((field) => values[field] !== estimated.values[field]);
    return changed ? "ai_edited" : "ai_confirmed";
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
        eaten_at: momentOf(day, time),
        name: name.trim(),
        calories: Number(values.calories),
        protein_g: Number(values.protein_g),
        carbs_g: Number(values.carbs_g),
        fat_g: Number(values.fat_g),
        source: sourceFor(),
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
  const unsaved = describing.trim().length > 0 || hasEstimate || name.trim().length > 0;

  function cancel() {
    if (unsaved) setConfirmCancel(true);
    else onCancel();
  }

  function macroFields() {
    return (Object.keys(LIMITS) as (keyof Values)[]).map((field) => (
      <div key={field}>
        <label htmlFor={field}>{FIELD_LABEL[field]}</label>
        <input id={field} inputMode="decimal" value={values[field]} onChange={(e) => setValues({ ...values, [field]: e.target.value })} />
      </div>
    ));
  }

  return (
    <form onSubmit={submit} noValidate className="card add-form">
      <h1>Add meal{day !== localDay() ? ` for ${day}` : ""}</h1>

      <p className="visually-hidden" role="status">{announce}</p>

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
        {estimateError && <p className="error" role="alert">{estimateError}</p>}

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
          <div className="result">
            <div className="result-head">
              <input
                aria-label="Meal name"
                className="result-name"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="macro-grid">{macroFields()}</div>
            <p className="muted fine-print" style={{ textAlign: "left", margin: "10px 0 0" }}>
              Estimated with your {PROVIDER_NAME[provider as keyof typeof PROVIDER_NAME] ?? "AI"} key. Check it before saving.
            </p>
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
              </div>
            )}
          </div>
        )}
      </div>

      {needsKey && <KeyHelp onSaved={() => void estimate()} />}

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

      {manual && !hasEstimate && (
        <>
          <div className="manual-name">
            <label htmlFor="name">Name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="off" />
          </div>
          <div className="macro-grid">{macroFields()}</div>
        </>
      )}

      {!hasEstimate && !manual && (
        <button type="button" className="ghost other-link" onClick={() => setManual(true)}>
          Enter the numbers myself
        </button>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      {confirmCancel ? (
        <div className="meal-confirm" role="alert" style={{ marginTop: 16 }}>
          <p>Discard this meal? What you typed will be lost.</p>
          <span className="meal-actions">
            <button type="button" onClick={() => setConfirmCancel(false)} autoFocus>Keep editing</button>
            <button type="button" className="danger-solid" onClick={onCancel}>Discard</button>
          </span>
        </div>
      ) : (
        <div className="form-actions">
          {!hasEstimate && !manual && <p className="hint muted">Estimate a meal or enter the numbers first.</p>}
          <button type="button" className="ghost" onClick={cancel}>Cancel</button>
          <button type="submit" className="primary" disabled={saving || (!hasEstimate && !manual)}>
            {saving ? "Saving…" : "Save meal"}
          </button>
        </div>
      )}
    </form>
  );
}
