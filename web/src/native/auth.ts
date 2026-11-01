// Native sign-in orchestration. Dependencies are injected, so the rules can be tested without a device.
// See docs/factory/proposals/native-auth/DESIGN.md for the contract this follows.
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

function statusOf(err: unknown): number | undefined {
  return typeof err === "object" && err !== null && "status" in err ? (err as { status: number }).status : undefined;
}

export function createNativeAuth(deps: NativeDeps, bind: NativeBridge = nativeBridge) {
  // One refresh at a time. The server rotates refresh tokens, so two refreshes would look like reuse.
  let inflight: Promise<boolean> | null = null;

  async function keep(tokens: TokenResponse): Promise<void> {
    bind.accessToken = tokens.access_token;
    await deps.storage.set(tokens.refresh_token);
  }

  function refreshOnce(): Promise<boolean> {
    inflight ??= (async () => {
      const stored = await deps.storage.get();
      if (!stored) {
        bind.accessToken = null;
        return false;
      }
      try {
        await keep(await deps.refresh(stored));
        return true;
      } catch (err) {
        if (statusOf(err) === 401) {
          // The server refused the refresh token: the session is over, so the stored copy is removed.
          bind.accessToken = null;
          await deps.storage.remove();
        }
        // Any other failure (no connection) keeps the stored token, so the next launch can try again.
        return false;
      }
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  async function signIn(adult: boolean): Promise<void> {
    const attempt = await deps.createAttempt();
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
    await keep(await deps.complete(attempt.attempt_secret, idToken, adult));
  }

  async function signOut(): Promise<void> {
    const stored = await deps.storage.get();
    bind.accessToken = null;
    await deps.storage.remove();
    // The local session is cleared first. The server revocation is best effort: a failure here cannot keep
    // the device signed in.
    if (stored) await deps.logout(stored).catch(() => undefined);
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
