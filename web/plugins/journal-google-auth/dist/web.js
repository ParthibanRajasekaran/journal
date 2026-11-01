import { WebPlugin } from "@capacitor/core";
// In a browser the native sign-in is not used. Web sign-in is the backend redirect.
export class JournalGoogleAuthWeb extends WebPlugin {
    async login(_options) {
        throw Object.assign(new Error("Native Google sign-in is not available in a browser."), { code: "UNAVAILABLE" });
    }
}
