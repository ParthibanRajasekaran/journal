// The save attempt's id: a retry of the same save keeps it, leaving the form ends it.
import { beforeEach, describe, expect, it } from "vitest";
import { attemptFor, readStoredAttempt, writeStoredAttempt } from "./attempt";

const OWNER = "user-a";
let counter = 0;
const newId = () => `id-${(counter += 1)}`;

beforeEach(() => {
  sessionStorage.clear();
  counter = 0;
});

describe("save attempt identity", () => {
  it("a retry of the same ambiguous save keeps its original client_id, even after the form is reopened", () => {
    const first = attemptFor(readStoredAttempt(OWNER), "lunch|dal|300", newId);
    writeStoredAttempt(OWNER, first);

    // The form is closed without leaving (for example a reload) and reopened for the same meal.
    const retry = attemptFor(readStoredAttempt(OWNER), "lunch|dal|300", newId);

    expect(retry.id).toBe(first.id);
  });

  it("cancelling the form, then entering an identical meal, gets a new client_id", () => {
    const first = attemptFor(readStoredAttempt(OWNER), "lunch|dal|300", newId);
    writeStoredAttempt(OWNER, first);

    // Leaving the form on purpose clears the stored attempt.
    writeStoredAttempt(OWNER, null);
    const again = attemptFor(readStoredAttempt(OWNER), "lunch|dal|300", newId);

    expect(again.id).not.toBe(first.id);
  });

  it("a different meal never reuses another meal's id", () => {
    const first = attemptFor(null, "lunch|dal|300", newId);
    expect(attemptFor(first, "dinner|rice|500", newId).id).not.toBe(first.id);
  });

  it("attempts are kept per account", () => {
    writeStoredAttempt("user-a", { id: "a-1", key: "k" });
    expect(readStoredAttempt("user-b")).toBeNull();
    expect(readStoredAttempt("user-a")).toEqual({ id: "a-1", key: "k" });
  });
});
