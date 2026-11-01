import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, NewMeal } from "./api";
import { enqueue, flushQueue, readQueue } from "./offline";

const meal = (id: string): NewMeal => ({
  client_id: id,
  meal_type: "lunch",
  eaten_at: "2026-10-31T12:00:00.000Z",
  name: "Dal",
  calories: 300,
  protein_g: 12,
  carbs_g: 40,
  fat_g: 8,
  source: "manual",
});

const createMeal = vi.fn();
vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return { ...actual, api: { ...actual.api, createMeal: (m: NewMeal) => createMeal(m) } };
});

beforeEach(() => {
  localStorage.clear();
  createMeal.mockReset();
});
afterEach(() => localStorage.clear());

describe("offline meal queue", () => {
  it("keeps a meal once even if it is queued twice", () => {
    enqueue(meal("a"));
    enqueue(meal("a"));
    expect(readQueue()).toHaveLength(1);
  });

  it("sends waiting meals and clears them once the server has them", async () => {
    enqueue(meal("a"));
    enqueue(meal("b"));
    createMeal.mockResolvedValue({});
    expect(await flushQueue()).toBe(2);
    expect(readQueue()).toEqual([]);
  });

  it("keeps the queue and stops when the connection is still down", async () => {
    enqueue(meal("a"));
    enqueue(meal("b"));
    createMeal.mockRejectedValue(new ApiError(0, "offline"));
    expect(await flushQueue()).toBe(0);
    expect(readQueue()).toHaveLength(2);
    expect(createMeal).toHaveBeenCalledTimes(1);
  });

  it("survives a corrupted queue without crashing", () => {
    localStorage.setItem("journal.pending-meals", "{not json");
    expect(readQueue()).toEqual([]);
  });
});
