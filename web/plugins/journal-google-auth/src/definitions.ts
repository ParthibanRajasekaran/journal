// Public contract of the Journal Google sign-in plugin. Client IDs are public identifiers. No secret is taken or bundled.
export interface JournalGoogleLoginOptions {
  // Server-issued nonce for this attempt. Bound to the attempt on the backend.
  nonce: string;
  // The web application client ID. It is the audience of the ID token, on both platforms.
  webClientId: string;
  // The iOS client ID. Required on iOS only. Its reversed form must be a URL scheme in Info.plist.
  iosClientId?: string;
}

export interface JournalGoogleLoginResult {
  idToken: string;
}

// Every platform rejects with one of these codes, in the error's `code` property.
export type JournalGoogleErrorCode = "USER_CANCELLED" | "NOT_CONFIGURED" | "UNAVAILABLE" | "FAILED";

export interface JournalGoogleAuthPlugin {
  login(options: JournalGoogleLoginOptions): Promise<JournalGoogleLoginResult>;
}
