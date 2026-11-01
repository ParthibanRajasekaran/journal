// Deterministic race tests. Every "delayed" step is a deferred promise that the test resolves or rejects
// explicitly, so each interleaving happens exactly once and in a known order.
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import { createNativeAuth, SignInSuperseded, type NativeDeps, type TokenResponse } from "./auth";
import type { NativeBridge } from "./bridge";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tokens = (n: number): TokenResponse => ({ access_token: `access-${n}`, refresh_token: `refresh-${n}`, expires_in: 900 });

function harness(overrides: Partial<NativeDeps> = {}) {
  let stored: string | null = null;
  const attemptSecret = { n: 0 };
  const deps: NativeDeps = {
    createAttempt: vi.fn(async () => {
      attemptSecret.n += 1;
      return { attempt_secret: `attempt-${attemptSecret.n}`, nonce: `nonce-${attemptSecret.n}`, expires_in: 300 };
    }),
    cancelAttempt: vi.fn(async () => undefined),
    complete: vi.fn(async () => tokens(1)),
    refresh: vi.fn(async () => tokens(2)),
    logout: vi.fn(async () => undefined),
    googleLogin: vi.fn(async () => "id-token"),
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
  return { auth: createNativeAuth(deps, bind), deps, bind, stored: () => stored, seed: (v: string | null) => (stored = v) };
}

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

describe("stale refresh after logout", () => {
  it("a refresh that succeeds after sign-out does not restore tokens, and its rotated token is revoked", async () => {
    const pending = deferred<TokenResponse>();
    const h = harness({ refresh: vi.fn(() => pending.promise) });
    h.seed("refresh-old");
    const restoring = h.auth.restore();
    await flush();
    await h.auth.signOut();
    pending.resolve(tokens(2));
    expect(await restoring).toBe(false);
    expect(h.stored()).toBeNull();
    expect(h.bind.accessToken).toBeNull();
    expect(h.deps.logout).toHaveBeenLastCalledWith("refresh-2");
  });

  it("a refresh that fails with 401 after sign-out does not clear anything it did not own", async () => {
    const pending = deferred<TokenResponse>();
    const h = harness({ refresh: vi.fn(() => pending.promise) });
    h.seed("refresh-old");
    const restoring = h.auth.restore();
    await flush();
    await h.auth.signOut();
    h.seed(null); // as after sign-out
    pending.reject(new ApiError(401, "Sign in required."));
    expect(await restoring).toBe(false);
    expect(h.stored()).toBeNull();
  });
});

describe("stale sign-in", () => {
  it("a sign-in completing after sign-out stores nothing and revokes its session on the server", async () => {
    const pending = deferred<TokenResponse>();
    const h = harness({ complete: vi.fn(() => pending.promise) });
    const signing = h.auth.signIn(true);
    await flush();
    await h.auth.signOut();
    pending.resolve(tokens(1));
    await expect(signing).rejects.toBeInstanceOf(SignInSuperseded);
    expect(h.stored()).toBeNull();
    expect(h.bind.accessToken).toBeNull();
    expect(h.deps.logout).toHaveBeenCalledWith("refresh-1");
  });

  it("an older sign-in completing after a newer one never overwrites the newer account", async () => {
    const older = deferred<TokenResponse>();
    const newer = deferred<TokenResponse>();
    const h = harness({
      complete: vi
        .fn()
        .mockImplementationOnce(() => older.promise)
        .mockImplementationOnce(() => newer.promise),
    });
    const first = h.auth.signIn(true);
    await flush();
    const second = h.auth.signIn(true);
    await flush();
    newer.resolve(tokens(20));
    await second;
    older.resolve(tokens(10));
    await expect(first).rejects.toBeInstanceOf(SignInSuperseded);
    expect(h.stored()).toBe("refresh-20");
    expect(h.bind.accessToken).toBe("access-20");
    expect(h.deps.logout).toHaveBeenCalledWith("refresh-10");
  });

  it("a sign-in whose attempt is superseded before the SDK returns is cancelled, not completed", async () => {
    const sdk = deferred<string>();
    const h = harness({
      googleLogin: vi.fn().mockImplementationOnce(() => sdk.promise).mockImplementation(async () => "id-token-second"),
    });
    const first = h.auth.signIn(true);
    await flush();
    const second = h.auth.signIn(true);
    await flush();
    sdk.resolve("id-token-first");
    await expect(first).rejects.toBeInstanceOf(SignInSuperseded);
    expect(h.deps.cancelAttempt).toHaveBeenCalledWith("attempt-1");
    await second.catch(() => undefined);
    expect(h.deps.complete).toHaveBeenCalledTimes(1);
    expect(h.deps.complete).toHaveBeenCalledWith("attempt-2", "id-token-second", true);
  });
});

describe("delayed failures", () => {
  it("a delayed network failure of an old refresh does not delete the newer account's token", async () => {
    const pending = deferred<TokenResponse>();
    const h = harness({ refresh: vi.fn(() => pending.promise) });
    h.seed("refresh-old");
    const restoring = h.auth.restore();
    await flush();
    const newSignIn = h.auth.signIn(true);
    await newSignIn;
    pending.reject(new ApiError(0, "offline"));
    await restoring;
    expect(h.stored()).toBe("refresh-1");
    expect(h.bind.accessToken).toBe("access-1");
  });

  it("a delayed 401 for an old refresh does not clear a newer sign-in's stored token", async () => {
    const pending = deferred<TokenResponse>();
    const h = harness({ refresh: vi.fn(() => pending.promise) });
    h.seed("refresh-old");
    const restoring = h.auth.restore();
    await flush();
    await h.auth.signIn(true);
    pending.reject(new ApiError(401, "Sign in required."));
    await restoring;
    expect(h.stored()).toBe("refresh-1");
  });

  it("a restore that starts after a new sign-in is not joined to an older in-flight refresh", async () => {
    const old = deferred<TokenResponse>();
    const h = harness({ refresh: vi.fn().mockImplementationOnce(() => old.promise).mockImplementation(async () => tokens(3)) });
    h.seed("refresh-old");
    const stale = h.auth.refreshOnce();
    await flush();
    await h.auth.signIn(true);
    const fresh = await h.auth.refreshOnce();
    old.resolve(tokens(2));
    await stale;
    expect(fresh).toBe(true);
    expect(h.deps.refresh).toHaveBeenCalledTimes(2);
  });
});
