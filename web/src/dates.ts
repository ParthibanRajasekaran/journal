// The API groups meals by UTC calendar day. The app uses the same days, so the
// Today and Week screens match the server's totals.

// "Today" and every day on screen are the user's own calendar days.
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
