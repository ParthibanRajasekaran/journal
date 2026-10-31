import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./api";

// Each call gets its own Response, because a body can only be read once.
function mockFetch(make: () => Response) {
  const spy = vi.fn().mockImplementation(async () => make());
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("sends cookies and the CSRF header on changes, but not on reads", async () => {
    const spy = mockFetch(() => new Response(JSON.stringify({ id: "u" }), { status: 200 }));
    await api.me();
    const [, readInit] = spy.mock.calls[0];
    expect(readInit.credentials).toBe("include");
    expect(readInit.headers["X-Journal-Request"]).toBeUndefined();

    await api.deleteMeal("meal_1");
    const [, writeInit] = spy.mock.calls[1];
    expect(writeInit.headers["X-Journal-Request"]).toBe("1");
  });

  it("uses the client id as the idempotency key when creating a meal", async () => {
    const spy = mockFetch(() => new Response(JSON.stringify({ id: "meal_1" }), { status: 201 }));
    const clientId = "3f1c2a9e-5b7d-4e8a-9c01-2d6f7a8b9c10";
    await api.createMeal({
      client_id: clientId,
      meal_type: "lunch",
      eaten_at: "2026-10-29T12:00:00.000Z",
      name: "Soup",
      calories: 200,
      protein_g: 10,
      carbs_g: 20,
      fat_g: 5,
      source: "manual",
    });
    const [, init] = spy.mock.calls[0];
    expect(init.headers["Idempotency-Key"]).toBe(clientId);
  });

  it("turns a problem response into an ApiError with the server's message", async () => {
    mockFetch(() =>
      new Response(JSON.stringify({ detail: "Daily meal limit reached." }), {
        status: 429,
        headers: { "Content-Type": "application/problem+json" },
      }),
    );
    await expect(api.deleteMeal("meal_1")).rejects.toMatchObject({
      status: 429,
      message: "Daily meal limit reached.",
    });
    await expect(api.deleteMeal("meal_1")).rejects.toBeInstanceOf(ApiError);
  });

  it("refreshes the session once after a 401, then retries the request", async () => {
    const spy = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "usr_1" }), { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await expect(api.me()).resolves.toMatchObject({ id: "usr_1" });
    const urls = spy.mock.calls.map((call) => String(call[0]));
    expect(urls).toEqual(["/api/v1/me", "/api/v1/auth/refresh", "/api/v1/me"]);
  });

  it("does not try to refresh when the refresh itself is refused", async () => {
    const spy = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", spy);
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("turns a dropped connection into a plain message, not a browser error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api.me()).rejects.toMatchObject({ status: 0, message: expect.stringContaining("Can't reach Journal") });
  });

  it("announces a signed-out session when the renewal is refused", async () => {
    const listener = vi.fn();
    window.addEventListener("journal:signed-out", listener);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalled();
    window.removeEventListener("journal:signed-out", listener);
  });

  it("never puts an AI key in the URL", async () => {
    const spy = mockFetch(() => new Response(JSON.stringify({ provider: "openai" }), { status: 200 }));
    await api.saveAiKey("openai", "sk-" + "a".repeat(30), true);
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).not.toContain("sk-");
    expect(JSON.parse(init.body).api_key).toBe("sk-" + "a".repeat(30));
  });

  it("sends the consent flag as the user set it, never a fixed true", async () => {
    const spy = mockFetch(() => new Response(JSON.stringify({ provider: "openai" }), { status: 200 }));
    await api.saveAiKey("openai", "sk-" + "a".repeat(30), false);
    const [, init] = spy.mock.calls[0];
    expect(JSON.parse(init.body).acknowledge_provider_terms).toBe(false);
  });

  it("sends the version we read, so an out-of-date edit is refused", async () => {
    const spy = mockFetch(() => new Response(JSON.stringify({ id: "meal_1", version: 3 }), { status: 200 }));
    await api.updateMeal({ id: "meal_1", version: 2 }, { name: "Soup" });
    const [, init] = spy.mock.calls[0];
    expect(init.method).toBe("PATCH");
    expect(init.headers["If-Match"]).toBe("2");
  });
});

describe("request ownership guard", () => {
  const meal = {
    client_id: "3f1c2a9e-5b7d-4e8a-9c01-2d6f7a8b9c10",
    meal_type: "lunch" as const,
    eaten_at: "2026-10-29T12:00:00.000Z",
    name: "Soup",
    calories: 200,
    protein_g: 10,
    carbs_g: 20,
    fat_g: 5,
    source: "manual" as const,
  };

  it("does not resend a request after a refresh if the session changed meanwhile", async () => {
    // 1: the meal is refused with 401. 2: the refresh runs, and during it the session changes hands.
    let owner = "account-a";
    const spy = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/auth/refresh")) {
        owner = "account-b";
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 401 });
    });
    vi.stubGlobal("fetch", spy);

    await expect(api.createMeal(meal, () => owner === "account-a")).rejects.toMatchObject({ status: 401 });
    // Only the first request and the refresh were made. The meal was not replayed under account B.
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("refuses to send at all when the session already belongs to someone else", async () => {
    const spy = mockFetch(() => new Response(null, { status: 201 }));
    await expect(api.createMeal(meal, () => false)).rejects.toMatchObject({ status: 401 });
    expect(spy).not.toHaveBeenCalled();
  });
});


describe("expected account on creates", () => {
  const meal = {
    client_id: "3f1c2a9e-5b7d-4e8a-9c01-2d6f7a8b9c10",
    meal_type: "lunch" as const,
    eaten_at: "2026-10-29T12:00:00.000Z",
    name: "Soup",
    calories: 200,
    protein_g: 10,
    carbs_g: 20,
    fat_g: 5,
    source: "manual" as const,
  };

  it("names the account the write was made for", async () => {
    const spy = mockFetch(() => new Response(JSON.stringify({ id: "meal_1" }), { status: 201 }));
    await api.createMeal(meal, undefined, "usr_abc");
    const [, init] = spy.mock.calls[0];
    expect(init.headers["X-Journal-Expected-Account"]).toBe("usr_abc");
  });

  it("omits the header when no account is named", async () => {
    const spy = mockFetch(() => new Response(JSON.stringify({ id: "meal_1" }), { status: 201 }));
    await api.createMeal(meal);
    const [, init] = spy.mock.calls[0];
    expect(init.headers["X-Journal-Expected-Account"]).toBeUndefined();
  });
});
