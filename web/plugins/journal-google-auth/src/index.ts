import { registerPlugin } from "@capacitor/core";
import type { JournalGoogleAuthPlugin } from "./definitions";

export type * from "./definitions";

export const JournalGoogleAuth = registerPlugin<JournalGoogleAuthPlugin>("JournalGoogleAuth", {
  web: () => import("./web").then((m) => new m.JournalGoogleAuthWeb()),
});
