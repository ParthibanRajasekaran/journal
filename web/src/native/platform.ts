// Device adapters: the Capacitor plugins. Kept apart from the rules in auth.ts, which are tested without them.
import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { KeychainAccess, SecureStorage } from "@aparajita/capacitor-secure-storage";

export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

// Public client IDs, set at build time. They are not secrets. An unset value disables native sign-in.
const WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID ?? "";
const IOS_CLIENT_ID = import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID ?? "";
export const nativeSignInConfigured = (): boolean => WEB_CLIENT_ID !== "";

let initialized: Promise<void> | null = null;

export function initGoogle(): Promise<void> {
  initialized ??= (async () => {
    await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly).catch(() => undefined);
    await SocialLogin.initialize({
      google: {
        webClientId: WEB_CLIENT_ID,
        iOSClientId: IOS_CLIENT_ID || undefined,
        iOSServerClientId: WEB_CLIENT_ID,
        mode: "online",
      },
    });
  })();
  return initialized;
}

export async function googleLogin(nonce: string): Promise<string> {
  await initGoogle();
  const response = await SocialLogin.login({ provider: "google", options: { nonce, scopes: ["email", "profile"] } });
  // Offline mode returns only an authorization code. This app needs the ID token, so anything else is refused.
  const result = response.result;
  if (!result || !("idToken" in result) || !result.idToken) throw new Error("Google returned no ID token.");
  return result.idToken;
}

const KEY = "journal.refresh";

export const secureStorage = {
  get: () => SecureStorage.getItem(KEY),
  set: (value: string) => SecureStorage.setItem(KEY, value),
  remove: () => SecureStorage.removeItem(KEY),
};
