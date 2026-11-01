// Meals that could not be saved because the connection dropped. They wait on this device and are
// sent again when the app is back online. Each meal keeps its client_id, so the server treats a
// repeat as the same meal and never saves it twice.
import { api, ApiError, NewMeal } from "./api";

const KEY = "journal.pending-meals";

export function readQueue(): NewMeal[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as NewMeal[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(meals: NewMeal[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(meals));
  } catch {
    // Storage can be full or blocked. The meal is then not kept, and the user is told it failed.
  }
}

export function enqueue(meal: NewMeal): void {
  writeQueue([...readQueue().filter((m) => m.client_id !== meal.client_id), meal]);
}

// Sends every waiting meal. Stops at the first sign of no connection. A meal leaves the queue only
// once the server has it, so nothing is lost if the send is interrupted.
export async function flushQueue(): Promise<number> {
  let sent = 0;
  for (const meal of readQueue()) {
    try {
      await api.createMeal(meal);
      writeQueue(readQueue().filter((m) => m.client_id !== meal.client_id));
      sent += 1;
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) break;
    }
  }
  return sent;
}
