export interface JournalGoogleLoginOptions {
    nonce: string;
    webClientId: string;
    iosClientId?: string;
}
export interface JournalGoogleLoginResult {
    idToken: string;
}
export type JournalGoogleErrorCode = "USER_CANCELLED" | "NOT_CONFIGURED" | "UNAVAILABLE" | "FAILED";
export interface JournalGoogleAuthPlugin {
    login(options: JournalGoogleLoginOptions): Promise<JournalGoogleLoginResult>;
}
