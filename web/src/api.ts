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
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
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
const BASE = "/api/v1";

async function request<T>(method: string, path: string, body?: unknown, extra?: Record<string, string>): Promise<T> {
  const headers: Record<string, string> = { ...extra };
  if (method !== "GET") Object.assign(headers, CSRF_HEADER);
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(BASE + path, {
    method,
    credentials: "include",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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
  updateMe: (patch: { display_name?: string; daily_targets?: { calories?: number | null; protein_g?: number | null } }) =>
    request<Profile>("PATCH", "/me", patch),
  deleteAccount: () => request<void>("DELETE", "/me"),
  logout: () => request<void>("POST", "/auth/logout"),

  day: (date: string, tz: string) => request<DaySummary>("GET", `/days/${date}?tz=${encodeURIComponent(tz)}`),
  week: (start: string, tz: string) => request<Totals[]>("GET", `/week?start=${start}&tz=${encodeURIComponent(tz)}`),

  createMeal: (meal: NewMeal) =>
    request<Meal>("POST", "/meals", meal, { "Idempotency-Key": meal.client_id }),
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
