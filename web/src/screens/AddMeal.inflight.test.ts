// Interaction regression: Cancel and Discard during an in-flight save. The form is rendered with react-dom in the
// existing jsdom environment. No component-test framework is added. The save is held open by hand, so each
// outcome can be chosen by the test.
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../api";
import { readStoredAttempt } from "../attempt";
import { readQueue } from "../offline";
import { AddMeal } from "./AddMeal";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, api: { ...actual.api, createMeal: vi.fn() } };
});

const OWNER = "user-a";
const DRAFT_KEY = "journal.add-draft";
const OFFLINE = "Can't reach Journal right now. Check your connection, then try again.";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let onDone: ReturnType<typeof vi.fn>;
let onCancel: ReturnType<typeof vi.fn>;

// A manual draft, so Save is enabled without an estimate.
function seedManualDraft(): void {
  sessionStorage.setItem(
    `${DRAFT_KEY}:${OWNER}`,
    JSON.stringify({
      describing: "",
      name: "Dal",
      time: "12:00",
      mealType: "lunch",
      values: { calories: "300", protein_g: "12", carbs_g: "40", fat_g: "8" },
      manual: true,
    }),
  );
}

function mount(): void {
  act(() => {
    root.render(createElement(AddMeal, { owner: OWNER, day: "2026-10-31", onDone, onCancel }));
  });
}

function button(label: RegExp): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((b) => label.test(b.textContent ?? ""));
  if (!found) throw new Error(`no button matching ${label}`);
  return found;
}

function clickButton(label: RegExp): void {
  act(() => {
    button(label).click();
  });
}

// Each call to createMeal is held open until the test settles it.
type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void; clientId: string };
const pending: Pending[] = [];
function holdSaves(): void {
  vi.mocked(api.createMeal).mockImplementation(
    (meal) =>
      new Promise((resolve, reject) => {
        pending.push({ resolve, reject, clientId: meal.client_id });
      }) as ReturnType<typeof api.createMeal>,
  );
}
async function settle(outcome: "lost" | "server-error" | "ok"): Promise<void> {
  const next = pending.shift();
  if (!next) throw new Error("no save in flight");
  await act(async () => {
    if (outcome === "lost") next.reject(new ApiError(0, OFFLINE));
    else if (outcome === "server-error") next.reject(new ApiError(500, "Server error"));
    else next.resolve({});
    await Promise.resolve();
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  pending.length = 0;
  vi.mocked(api.createMeal).mockReset();
  holdSaves();
  onDone = vi.fn();
  onCancel = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  seedManualDraft();
  mount();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Cancel and Discard during an in-flight save", () => {
  it("Cancel is disabled while the save is pending, and the save id is kept", async () => {
    clickButton(/Save meal/);
    const saving = pending[0];
    expect(saving).toBeDefined();
    expect(readStoredAttempt(OWNER)?.id).toBe(saving.clientId);

    expect(button(/Cancel/).disabled).toBe(true);
    clickButton(/Cancel/);

    expect(onCancel).not.toHaveBeenCalled();
    expect(readStoredAttempt(OWNER)?.id).toBe(saving.clientId);
    await settle("ok");
  });

  it("while a save is pending the discard confirmation cannot open, so Discard cannot leave the form", async () => {
    clickButton(/Save meal/);
    const saving = pending[0];

    // Cancel is disabled, so the confirmation (and its Discard button) never appears during the save.
    clickButton(/Cancel/);
    expect(container.querySelector(".meal-confirm")).toBeNull();
    expect(
      [...container.querySelectorAll("button")].some((b) => /Discard/.test(b.textContent ?? "")),
    ).toBe(false);

    expect(onCancel).not.toHaveBeenCalled();
    expect(readStoredAttempt(OWNER)?.id).toBe(saving.clientId);
    await settle("ok");
  });

  it("a lost response queues the meal under the id of the save that was in flight", async () => {
    clickButton(/Save meal/);
    const inFlight = pending[0].clientId;

    await settle("lost");

    expect(readQueue(OWNER).map((e) => e.meal.client_id)).toEqual([inFlight]);
    expect(onDone).toHaveBeenCalled();
  });

  it("a retry after an ambiguous server error sends the same client_id again", async () => {
    clickButton(/Save meal/);
    const first = pending[0].clientId;
    await settle("server-error");
    expect(onDone).not.toHaveBeenCalled();
    expect(readStoredAttempt(OWNER)?.id).toBe(first);

    clickButton(/Save meal/);
    expect(pending[0].clientId).toBe(first);
    await settle("ok");
    expect(onDone).toHaveBeenCalled();
  });

  it("leaving on purpose after an ambiguous outcome releases the id, so the next identical meal is new", async () => {
    clickButton(/Save meal/);
    const first = pending[0].clientId;
    await settle("server-error");

    clickButton(/Cancel/);
    clickButton(/Discard/);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(readStoredAttempt(OWNER)).toBeNull();
  });
});
