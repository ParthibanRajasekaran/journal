import { useState } from "react";

// Common meal times as chips, with an animated highlight, and a manual option.
const PRESETS = [
  { label: "Breakfast", time: "08:00" },
  { label: "Lunch", time: "13:00" },
  { label: "Snack", time: "16:30" },
  { label: "Dinner", time: "19:30" },
];

function nowRounded(): string {
  const d = new Date();
  const minutes = Math.round(d.getMinutes() / 5) * 5;
  d.setMinutes(minutes, 0, 0);
  return d.toTimeString().slice(0, 5);
}

interface Props {
  value: string;
  onChange: (time: string) => void;
}

export function TimePicker({ value, onChange }: Props) {
  const [manual, setManual] = useState(false);
  const activeIndex = PRESETS.findIndex((p) => p.time === value);
  const isNow = value === nowRounded();

  return (
    <div className="time-picker">
      <span className="label-text">When did you eat?</span>
      <div className="chips" role="radiogroup" aria-label="Time of day">
        {PRESETS.map((p, index) => (
          <button
            key={p.label}
            type="button"
            role="radio"
            aria-checked={activeIndex === index && !manual}
            className={`chip ${activeIndex === index && !manual ? "chip-on" : ""}`}
            onClick={() => {
              setManual(false);
              onChange(p.time);
            }}
          >
            <span>{p.label}</span>
            <small>{p.time}</small>
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={isNow && !manual}
          className={`chip ${isNow && !manual ? "chip-on" : ""}`}
          onClick={() => {
            setManual(false);
            onChange(nowRounded());
          }}
        >
          <span>Now</span>
        </button>
        <button type="button" role="radio" aria-checked={manual} className={`chip ${manual ? "chip-on" : ""}`} onClick={() => setManual(true)}>
          <span>Other</span>
        </button>
      </div>
      {manual && (
        <input
          className="time-manual"
          type="time"
          aria-label="Exact time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
