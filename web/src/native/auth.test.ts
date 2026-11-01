import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError } from "../api";
import { createNativeAuth, SignInCancelled, USER_CANCELLED, type NativeDeps } from "./auth";
import type { NativeBridge } from "./bridge";

// Fake device and server. No token value is printed by any assertion.
function harness(overrides: Partial<NativeDeps> = {}) {
  let stored: string | null = null;
  const deps: NativeDeps = {
    createAttempt: vi.fn(async () => ({ attempt_secret: "fixture-attempt-value", nonce: "nonce-abc", expires_in: 300 })),
    cancelAttempt: vi.fn(async () => undefined),
    complete: vi.fn(async () => ({ access_token: "access-1", refresh_token: "refresh-1", expires_in: 900 })),
    refresh: vi.fn(async () => ({ access_token: "access-2", refresh_token: "refresh-2", expires_in: 900 })),
    logout: vi.fn(async () => undefined),
    googleLogin: vi.fn(async () => "id-token-1"),
    storage: {
      get: vi.fn(async () => stored),
      set: vi.fn(async (value: string) => {
        stored = value;
      }),
      remove: vi.fn(async () => {
        stored = null;
      }),
    },
    ...overrides,
  };
  const bind: NativeBridge = { accessToken: null, refresh: null, signOut: null };
  return { auth: createNativeAuth(deps, bind), deps, bind, stored: () => stored, setStored: (v: string | null) => (stored = v) };
}

beforeEach(() => vi.clearAllMocks());

describe("native sign-in", () => {
  it("binds the Google login to the attempt's nonce and completes that attempt only", async () => {
    const h = harness();
    await h.auth.signIn(true);
    expect(h.deps.googleLogin).toHaveBeenCalledWith("nonce-abc");
    expect(h.deps.complete).toHaveBeenCalledWith("fixture-attempt-value", "id-token-1", true);
    expect(h.bind.accessToken).toBe("access-1");
    expect(h.stored()).toBe("refresh-1");
  });

  it("forwards the 18+ confirmation to the server rather than deciding it on the device", async () => {
    const h = harness();
    await h.auth.signIn(false);
    expect(h.deps.complete).toHaveBeenCalledWith(expect.any(String), "id-token-1", false);
  });

  it("a user who backs out cancels the attempt, stores nothing and reports a cancellation", async () => {
    const h = harness({
      googleLogin: vi.fn(async () => {
        throw Object.assign(new Error("cancelled"), { code: USER_CANCELLED });
      }),
    });
    await expect(h.auth.signIn(true)).rejects.toBeInstanceOf(SignInCancelled);
    expect(h.deps.cancelAttempt).toHaveBeenCalledWith("fixture-attempt-value");
    expect(h.deps.complete).not.toHaveBeenCalled();
    expect(h.stored()).toBeNull();
    expect(h.bind.accessToken).toBeNull();
  });

  it("a plugin failure other than cancellation cancels the attempt and is rethrown", async () => {
    const h = harness({ googleLogin: vi.fn(async () => { throw new Error("no credential"); }) });
    await expect(h.auth.signIn(true)).rejects.toThrow("no credential");
    expect(h.deps.cancelAttempt).toHaveBeenCalledTimes(1);
    expect(h.deps.complete).not.toHaveBeenCalled();
  });

  it("a refused completion stores nothing, so the device keeps no half-signed-in state", async () => {
    const h = harness({
      complete: vi.fn(async () => {
        throw new ApiError(401, "Sign-in could not be completed. Start again.");
      }),
    });
    await expect(h.auth.signIn(true)).rejects.toMatchObject({ status: 401 });
    expect(h.stored()).toBeNull();
    expect(h.bind.accessToken).toBeNull();
  });
});

describe("restore, refresh and sign-out", () => {
  it("restores a stored session by rotating its refresh token and storing the new one", async () => {
    const h = harness();
    h.setStored("refresh-old");
    expect(await h.auth.restore()).toBe(true);
    expect(h.deps.refresh).toHaveBeenCalledWith("refresh-old");
    expect(h.stored()).toBe("refresh-2");
    expect(h.bind.accessToken).toBe("access-2");
  });

  it("does not restore when nothing is stored, and never tries the network", async () => {
    const h = harness();
    expect(await h.auth.restore()).toBe(false);
    expect(h.deps.refresh).not.toHaveBeenCalled();
  });

  it("a refused refresh token clears the device's copy", async () => {
    const h = harness({ refresh: vi.fn(async () => { throw new ApiError(401, "Sign in required."); }) });
    h.setStored("refresh-revoked");
    expect(await h.auth.restore()).toBe(false);
    expect(h.stored()).toBeNull();
    expect(h.bind.accessToken).toBeNull();
  });

  it("a failed connection keeps the stored token, so the next launch can try again", async () => {
    const h = harness({ refresh: vi.fn(async () => { throw new ApiError(0, "offline"); }) });
    h.setStored("refresh-keep");
    expect(await h.auth.restore()).toBe(false);
    expect(h.stored()).toBe("refresh-keep");
  });

  it("concurrent refreshes share one rotation, so the server never sees a reuse", async () => {
    const h = harness();
    h.setStored("refresh-1");
    const results = await Promise.all([h.auth.refreshOnce(), h.auth.refreshOnce(), h.auth.refreshOnce()]);
    expect(results).toEqual([true, true, true]);
    expect(h.deps.refresh).toHaveBeenCalledTimes(1);
  });

  it("sign-out clears the device first and revokes on the server with the stored token", async () => {
    const h = harness();
    h.setStored("refresh-live");
    h.bind.accessToken = "access-live";
    await h.auth.signOut();
    expect(h.bind.accessToken).toBeNull();
    expect(h.stored()).toBeNull();
    expect(h.deps.logout).toHaveBeenCalledWith("refresh-live");
  });

  it("sign-out still clears the device when the server cannot be reached", async () => {
    const h = harness({ logout: vi.fn(async () => { throw new ApiError(0, "offline"); }) });
    h.setStored("refresh-live");
    await expect(h.auth.signOut()).resolves.toBeUndefined();
    expect(h.stored()).toBeNull();
  });

  it("registers the bridge so the API client uses the native refresh and sign-out", async () => {
    const h = harness();
    h.auth.register();
    expect(h.bind.refresh).toBeTypeOf("function");
    expect(h.bind.signOut).toBeTypeOf("function");
  });
});
