// Google sign-in through the Journal plugin: configuration checks and error normalisation.
// Pure and injectable, so the rules are tested without a device. The native code runs in the plugin itself.

export type NativePlatform = "ios" | "android" | "web";

export interface GoogleConfig {
  platform: NativePlatform;
  webClientId: string;
  iosClientId: string;
}

export interface GoogleLoginPlugin {
  login(options: { nonce: string; webClientId: string; iosClientId?: string }): Promise<{ idToken: string }>;
}

export const GOOGLE_ERROR_CODES = ["USER_CANCELLED", "NOT_CONFIGURED", "UNAVAILABLE", "FAILED"] as const;
export type GoogleErrorCode = (typeof GOOGLE_ERROR_CODES)[number];

export class GoogleSignInError extends Error {
  constructor(
    readonly code: GoogleErrorCode,
    message: string,
  ) {
    super(message);
  }
}

// Names what is missing, never a value. The client IDs are public, but the message stays short either way.
export function missingConfiguration(config: GoogleConfig): string | null {
  if (!config.webClientId) return "VITE_GOOGLE_WEB_CLIENT_ID is not set for this build";
  if (config.platform === "ios" && !config.iosClientId) return "VITE_GOOGLE_IOS_CLIENT_ID is not set for this iPhone build";
  return null;
}

export function nativeSignInReady(config: GoogleConfig): boolean {
  return config.platform !== "web" && missingConfiguration(config) === null;
}

function codeOf(err: unknown): GoogleErrorCode {
  const code = typeof err === "object" && err !== null ? (err as { code?: unknown }).code : undefined;
  return typeof code === "string" && (GOOGLE_ERROR_CODES as readonly string[]).includes(code) ? (code as GoogleErrorCode) : "FAILED";
}

// Every platform's failure reaches the app as one of the codes above, with a message that carries no token.
export async function googleIdToken(plugin: GoogleLoginPlugin, config: GoogleConfig, nonce: string): Promise<string> {
  const missing = missingConfiguration(config);
  if (missing) throw new GoogleSignInError("NOT_CONFIGURED", missing);
  if (!nonce) throw new GoogleSignInError("FAILED", "A sign-in nonce is required.");
  try {
    const result = await plugin.login({
      nonce,
      webClientId: config.webClientId,
      iosClientId: config.platform === "ios" ? config.iosClientId : undefined,
    });
    if (!result || typeof result.idToken !== "string" || result.idToken === "") {
      throw new GoogleSignInError("FAILED", "Google returned no ID token.");
    }
    return result.idToken;
  } catch (err) {
    if (err instanceof GoogleSignInError) throw err;
    const code = codeOf(err);
    const message = err instanceof Error ? err.message : "Google sign-in failed.";
    throw new GoogleSignInError(code, message);
  }
}
