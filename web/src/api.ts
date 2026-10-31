// Typed client for the Journal API. The browser holds only HttpOnly cookies, so every
// request sends credentials, and every change carries the CSRF header the API requires.

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Provider = "openai" | "anthropic" | "gemini";

export interface Totals {
  date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_count: number;
}

export interface Meal {
  id: string;
  client_id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack" | "other";
  eaten_at: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: string;
  version: number;
}

export interface DaySummary extends Totals {
  meals: Meal[];
  targets: { calories: number | null; protein_g: number | null };
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  daily_targets: { calories: number | null; protein_g: number | null };
  encouragement_enabled: boolean;
}

export interface AiKeyStatus {
  provider: Provider;
  last4: string;
  validated_at: string;
}

export interface NewMeal {
  client_id: string;
  meal_type: Meal["meal_type"];
  eaten_at: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: "manual" | "ai_confirmed" | "ai_edited";
}

export interface EstimateQuestion {
  id: string;
  question: string;
  options: string[];
  default: string;
}

export interface SuppliedAnswer extends EstimateQuestion {
  answer: string;
}

export interface EstimateItem {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export type EstimateReply =
  | { status: "needs_answers"; provider: Provider; questions: EstimateQuestion[] }
  | {
      status: "estimate";
      provider: Provider;
      estimate: {
        name: string;
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        confidence: number;
        items: EstimateItem[];
        assumptions: string[];
      };
    };

export const CSRF_HEADER = { "X-Journal-Request": "1" } as const;
// Empty for the web build, which is served by the API. Native builds set VITE_API_BASE to the
// HTTPS origin of the backend, for example https://journal.example.
const BASE = `${import.meta.env.VITE_API_BASE ?? ""}/api/v1`;

// Shown when the connection drops, so no raw browser message reaches the user.
export const OFFLINE_MESSAGE = "Can't reach Journal right now. Check your connection, then try again.";
// Raised when the session can no longer be renewed. The app listens and returns to sign-in.
export const SIGNED_OUT_EVENT = "journal:signed-out";

async function send(method: string, path: string, body?: unknown, extra?: Record<string, string>): Promise<Response> {
  const headers: Record<string, string> = { ...extra };
  if (method !== "GET") Object.assign(headers, CSRF_HEADER);
  if (body !== undefined) headers["Content-Type"] = "application/json";
  try {
    return await fetch(BASE + path, {
      method,
      credentials: "include",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, OFFLINE_MESSAGE);
  }
}

// The access cookie lasts 15 minutes. One refresh is shared by every request that needs it: the
// server rotates refresh tokens, so two refreshes at once would look like reuse and end the session.
let refreshing: Promise<boolean> | null = null;
function refreshSession(): Promise<boolean> {
  refreshing ??= send("POST", "/auth/refresh")
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// Raised instead of sending when the session now belongs to another account. Nothing is sent.
export const STALE_SESSION = "The signed-in account changed. This request was not sent.";

// `guard` is checked before the first send and again before any resend after a refresh. A request
// made for one account is never replayed on another account's session.
async function request<T>(method: string, path: string, body?: unknown, extra?: Record<string, string>, guard?: () => boolean): Promise<T> {
  if (guard && !guard()) throw new ApiError(401, STALE_SESSION);
  let response = await send(method, path, body, extra);
  if (response.status === 401 && !path.startsWith("/auth/")) {
    if (await refreshSession()) {
      if (guard && !guard()) throw new ApiError(401, STALE_SESSION);
      response = await send(method, path, body, extra);
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
    }
  }
  if (response.status === 204) return undefined as T;
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const problem = (await response.json()) as { detail?: string };
      if (problem.detail) detail = problem.detail;
    } catch {
      // Not a problem document; keep the generic message.
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export const api = {
  signInUrl: `${BASE}/auth/google/start`,
  me: () => request<Profile>("GET", "/me"),
  // A target set to null is cleared.
  updateMe: (patch: {
    display_name?: string;
    daily_targets?: { calories?: number | null; protein_g?: number | null };
    encouragement_enabled?: boolean;
  }) =>
    request<Profile>("PATCH", "/me", patch),
  deleteAccount: () => request<void>("DELETE", "/me"),
  logout: () => request<void>("POST", "/auth/logout"),

  day: (date: string, tz: string) => request<DaySummary>("GET", `/days/${date}?tz=${encodeURIComponent(tz)}`),
  week: (start: string, tz: string) => request<Totals[]>("GET", `/week?start=${start}&tz=${encodeURIComponent(tz)}`),

  createMeal: (meal: NewMeal, guard?: () => boolean) =>
    request<Meal>("POST", "/meals", meal, { "Idempotency-Key": meal.client_id }, guard),
  updateMeal: (meal: Pick<Meal, "id" | "version">, patch: Partial<Omit<NewMeal, "client_id" | "source">>) =>
    request<Meal>("PATCH", `/meals/${meal.id}`, patch, { "If-Match": String(meal.version) }),
  deleteMeal: (id: string) => request<void>("DELETE", `/meals/${id}`),

  estimate: (text: string, answers?: SuppliedAnswer[]) =>
    request<EstimateReply>("POST", "/estimates", answers ? { text, answers } : { text }),

  aiKeys: () => request<AiKeyStatus[]>("GET", "/me/ai-keys"),
  // The server refuses a save unless the user has agreed, so the flag is sent as the user set it.
  saveAiKey: (provider: Provider, apiKey: string, agreed: boolean) =>
    request<AiKeyStatus>("PUT", `/me/ai-keys/${provider}`, {
      api_key: apiKey,
      acknowledge_provider_terms: agreed,
    }),
  deleteAiKey: (provider: Provider) => request<void>("DELETE", `/me/ai-keys/${provider}`),
};
