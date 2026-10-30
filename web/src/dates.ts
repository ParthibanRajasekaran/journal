// Days are the user's own calendar days. The browser sends its time zone with each day or week
// request, and the server groups meals by that zone, so totals match what the user sees.

export const userTz: string = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function localDay(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA"); // YYYY-MM-DD in the user's time zone
}

export function addDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function mondayOf(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  return addDays(day, -offset);
}

export function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// The day and HH:MM of a stored moment, in the user's own zone (for the edit form).
export function dayAndTime(iso: string): { day: string; time: string } {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    day: localDay(date),
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

// A day and HH:MM in the user's zone, as an exact moment for the API.
export function momentOf(day: string, time: string): string {
  return new Date(`${day}T${time}:00`).toISOString();
}
