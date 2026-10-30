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

  it("never puts an AI key in the URL", async () => {
    const spy = mockFetch(() => new Response(JSON.stringify({ provider: "openai" }), { status: 200 }));
    await api.saveAiKey("openai", "sk-" + "a".repeat(30));
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).not.toContain("sk-");
    expect(JSON.parse(init.body).api_key).toBe("sk-" + "a".repeat(30));
  });
});
