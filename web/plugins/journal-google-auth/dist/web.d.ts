import { WebPlugin } from "@capacitor/core";
import type { JournalGoogleAuthPlugin, JournalGoogleLoginOptions, JournalGoogleLoginResult } from "./definitions";
export declare class JournalGoogleAuthWeb extends WebPlugin implements JournalGoogleAuthPlugin {
    login(_options: JournalGoogleLoginOptions): Promise<JournalGoogleLoginResult>;
}
