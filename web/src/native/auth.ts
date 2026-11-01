// Native sign-in orchestration. Dependencies are injected, so the rules can be tested without a device.
// See docs/factory/proposals/native-auth/DESIGN.md for the contract this follows.
//
// Stale operations: every sign-in and every sign-out advances a generation. A refresh or sign-in that started
// earlier may finish later. When it does, it must not store tokens or touch the device's state. If it obtained
// tokens, those tokens are revoked on the server, so no session exists that the device does not hold.
// All device-storage writes go through one queue, and each re-checks the generation when it runs.
import { nativeBridge, type NativeBridge } from "./bridge";

export const USER_CANCELLED = "USER_CANCELLED";

export interface AttemptResponse {
  attempt_secret: string;
  nonce: string;
  expires_in: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface NativeDeps {
  createAttempt: () => Promise<AttemptResponse>;
  cancelAttempt: (attemptSecret: string) => Promise<void>;
  complete: (attemptSecret: string, idToken: string, adult: boolean) => Promise<TokenResponse>;
  refresh: (refreshToken: string) => Promise<TokenResponse>;
  logout: (refreshToken: string) => Promise<void>;
  // Resolves with the ID token. Rejects with an error whose `code` is USER_CANCELLED when the user backs out.
  googleLogin: (nonce: string) => Promise<string>;
  storage: {
    get: () => Promise<string | null>;
    set: (value: string) => Promise<void>;
    remove: () => Promise<void>;
  };
}

export class SignInCancelled extends Error {
  constructor() {
    super("Sign-in was cancelled.");
  }
}

// A sign-in that was overtaken by sign-out or by a newer sign-in. Its outcome is discarded.
export class SignInSuperseded extends Error {
  constructor() {
    super("This sign-in was replaced by a newer one, or by sign-out.");
  }
}

function statusOf(err: unknown): number | undefined {
  return typeof err === "object" && err !== null && "status" in err ? (err as { status: number }).status : undefined;
}

export function createNativeAuth(deps: NativeDeps, bind: NativeBridge = nativeBridge) {
  let generation = 0;
  let inflight: { gen: number; promise: Promise<boolean> } | null = null;

  // One queue for device-storage writes, so a later operation's write cannot be overtaken by an earlier one.
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  const current = (gen: number) => gen === generation;

  async function revokeQuietly(refreshToken: string): Promise<void> {
    await deps.logout(refreshToken).catch(() => undefined);
  }

  // Keeps tokens only if this operation is still the current one. Otherwise the new session is revoked.
  function keepIfCurrent(gen: number, tokens: TokenResponse): Promise<boolean> {
    return serial(async () => {
      if (!current(gen)) {
        await revokeQuietly(tokens.refresh_token);
        return false;
      }
      bind.accessToken = tokens.access_token;
      await deps.storage.set(tokens.refresh_token);
      return true;
    });
  }

  function refreshOnce(): Promise<boolean> {
    if (inflight && inflight.gen === generation) return inflight.promise;
    const gen = generation;
    const promise = (async () => {
      const stored = await serial(() => deps.storage.get());
      if (!stored) {
        if (current(gen)) bind.accessToken = null;
        return false;
      }
      try {
        const tokens = await deps.refresh(stored);
        return await keepIfCurrent(gen, tokens);
      } catch (err) {
        if (current(gen) && statusOf(err) === 401) {
          // The server refused the refresh token: the session is over, so the stored copy is removed.
          bind.accessToken = null;
          await serial(() => deps.storage.remove());
        }
        // A stale operation changes nothing. Any other failure (no connection) keeps the stored token.
        return false;
      }
    })().finally(() => {
      if (inflight && inflight.promise === promise) inflight = null;
    });
    inflight = { gen, promise };
    return promise;
  }

  async function signIn(adult: boolean): Promise<void> {
    const gen = ++generation;
    inflight = null;
    const attempt = await deps.createAttempt();
    if (!current(gen)) {
      await deps.cancelAttempt(attempt.attempt_secret).catch(() => undefined);
      throw new SignInSuperseded();
    }
    let idToken: string;
    try {
      idToken = await deps.googleLogin(attempt.nonce);
    } catch (err) {
      // The attempt is abandoned either way. A retry always starts a new attempt.
      await deps.cancelAttempt(attempt.attempt_secret).catch(() => undefined);
      if (typeof err === "object" && err !== null && (err as { code?: string }).code === USER_CANCELLED) {
        throw new SignInCancelled();
      }
      throw err;
    }
    if (!current(gen)) {
      await deps.cancelAttempt(attempt.attempt_secret).catch(() => undefined);
      throw new SignInSuperseded();
    }
    const tokens = await deps.complete(attempt.attempt_secret, idToken, adult);
    if (!(await keepIfCurrent(gen, tokens))) throw new SignInSuperseded();
  }

  async function signOut(): Promise<void> {
    generation += 1;
    inflight = null;
    bind.accessToken = null;
    const stored = await serial(async () => {
      const previous = await deps.storage.get();
      await deps.storage.remove();
      return previous;
    });
    // The device is cleared first. The server revocation is best effort: a failure cannot keep the device signed in.
    if (stored) await revokeQuietly(stored);
  }

  function register(): void {
    bind.refresh = refreshOnce;
    bind.signOut = signOut;
  }

  async function restore(): Promise<boolean> {
    register();
    return refreshOnce();
  }

  return { signIn, restore, refreshOnce, signOut, register };
}
