import { FormEvent, useEffect, useRef, useState } from "react";
import { api, ApiError, EstimateItem, EstimateQuestion, Meal, SuppliedAnswer } from "../api";
import { localDay, momentOf } from "../dates";
import { MealTimePicker, mealFor, nowRounded } from "./TimePicker";
import { KeyHelp } from "./KeyHelp";
import { Hourglass as HourglassIcon } from "lucide-react";

interface Props {
  day: string;
  onDone: () => void;
  onCancel: () => void;
}

const LIMITS = { calories: [0, 5000], protein_g: [0, 300], carbs_g: [0, 500], fat_g: [0, 300] } as const;
const PROVIDER_NAME = { openai: "OpenAI", anthropic: "Claude", gemini: "Gemini" } as const;

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
  const [start] = useState(nowRounded);
  const [mealType, setMealType] = useState<Meal["meal_type"]>(() => mealFor(start));
  const [time, setTime] = useState(start);
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
  const [replaceOk, setReplaceOk] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const questionsRef = useRef<HTMLDivElement>(null);

  // Keep keyboard focus on the next thing the user needs, so it never falls back to the page top.
  useEffect(() => {
    if (questions) questionsRef.current?.querySelector("button")?.focus();
  }, [questions]);
  useEffect(() => {
    if (estimated) nameRef.current?.focus();
  }, [estimated]);

  function applyEstimate(result: Awaited<ReturnType<typeof api.estimate>>) {
    if (result.status === "needs_answers") {
      // Earlier results no longer apply, so clear them rather than leave them on screen.
      setQuestions(result.questions);
      setAnswers({});
      setProvider(null);
      setEstimated(null);
      setItems([]);
      setAssumptions([]);
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
    // A new estimate replaces what the user typed, so ask once before doing it.
    if (!withAnswers && !replaceOk && hasUserWork()) {
      setReplaceOk(true);
      return setEstimateError("This replaces the numbers and name you changed. Press Estimate again to continue.");
    }
    setReplaceOk(false);
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
    // Questions stay on screen until a reply arrives, so a failed request does not lose the answers.
    const supplied: SuppliedAnswer[] = (questions ?? []).map((q) => ({ ...q, answer: answers[q.id] ?? "unsure" }));
    void estimate(supplied);
  }

  function problem(): string | null {
    if (name.trim().length === 0) return "Describe the meal first, or enter a name.";
    for (const [field, [min, max]] of Object.entries(LIMITS)) {
      const raw = values[field as keyof Values];
      const number = Number(raw);
      if (raw === "" || Number.isNaN(number) || number < min || number > max) {
        return `${FIELD_LABEL[field as keyof Values]} must be between ${min} and ${max}.`;
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

  // True when the user has typed or changed something that a new estimate would replace.
  function hasUserWork(): boolean {
    if (provider !== null) return sourceFor() === "ai_edited";
    return name.trim() !== "" || Object.values(values).some((v) => v !== "");
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
          <button
            type="button"
            className={hasEstimate ? "ghost" : "primary"}
            onClick={() => estimate()}
            disabled={estimating}
          >
            {estimating ? "Working…" : hasEstimate ? "Re-estimate" : "Estimate"}
          </button>
        </div>
        {estimating && (
          <p className="estimating" role="status">
            <Hourglass />
            Estimating your meal…
          </p>
        )}
        {estimateError && <p className="error" role="alert">{estimateError}</p>}
        {!hasEstimate && !manual && (
          <button type="button" className="ghost other-link" onClick={() => setManual(true)}>
            Enter the numbers myself
          </button>
        )}

        {questions && (
          <div className="questions" role="group" aria-label="Quick questions" ref={questionsRef}>
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
              <label htmlFor="result-name" className="result-label">Meal name</label>
              <input
                id="result-name"
                ref={nameRef}
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
        <MealTimePicker
          mealType={mealType}
          time={time}
          onChange={(choice) => {
            setMealType(choice.mealType);
            setTime(choice.time);
          }}
        />
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
          {!hasEstimate && !manual && <p id="save-hint" className="hint muted">Estimate a meal or enter the numbers first.</p>}
          <button type="button" className="ghost" onClick={cancel}>Cancel</button>
          <button
            type="submit"
            className="primary"
            disabled={saving || (!hasEstimate && !manual)}
            aria-describedby={!hasEstimate && !manual ? "save-hint" : undefined}
          >
            {saving ? "Saving…" : "Save meal"}
          </button>
        </div>
      )}
    </form>
  );
}

// An hourglass that turns while the estimate runs. Reduced motion shows it still.
function Hourglass() {
  return (
    <span className="hourglass" aria-hidden="true">
      <HourglassIcon size={22} strokeWidth={1.8} />
    </span>
  );
}
