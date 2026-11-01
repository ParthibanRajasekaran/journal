import { WebPlugin } from "@capacitor/core";
import type { JournalGoogleAuthPlugin, JournalGoogleLoginOptions, JournalGoogleLoginResult } from "./definitions";

// In a browser the native sign-in is not used. Web sign-in is the backend redirect.
export class JournalGoogleAuthWeb extends WebPlugin implements JournalGoogleAuthPlugin {
  async login(_options: JournalGoogleLoginOptions): Promise<JournalGoogleLoginResult> {
    throw Object.assign(new Error("Native Google sign-in is not available in a browser."), { code: "UNAVAILABLE" });
  }
}
