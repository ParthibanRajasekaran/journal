// Device adapters: Capacitor and the Journal Google plugin. The rules are in google.ts and auth.ts, tested without a device.
import { Capacitor } from "@capacitor/core";
import { KeychainAccess, SecureStorage } from "@aparajita/capacitor-secure-storage";
import { JournalGoogleAuth } from "@journal/google-auth";
import { googleIdToken, nativeSignInReady, type GoogleConfig, type NativePlatform } from "./google";

export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

// Public client IDs, set at build time. They are identifiers, not secrets. No client secret is read or bundled.
const config: GoogleConfig = {
  platform: (Capacitor.getPlatform() as NativePlatform) ?? "web",
  webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID ?? "",
  iosClientId: import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID ?? "",
};

export const nativeSignInConfigured = (): boolean => nativeSignInReady(config);

let storageReady: Promise<void> | null = null;
function prepareStorage(): Promise<void> {
  storageReady ??= SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly).then(
    () => undefined,
    () => undefined,
  );
  return storageReady;
}

export function googleLogin(nonce: string): Promise<string> {
  return googleIdToken(JournalGoogleAuth, config, nonce);
}

const KEY = "journal.refresh";

export const secureStorage = {
  get: async () => {
    await prepareStorage();
    return SecureStorage.getItem(KEY);
  },
  set: async (value: string) => {
    await prepareStorage();
    await SecureStorage.setItem(KEY, value);
  },
  remove: async () => {
    await prepareStorage();
    await SecureStorage.removeItem(KEY);
  },
};
