import { registerPlugin } from "@capacitor/core";
export const JournalGoogleAuth = registerPlugin("JournalGoogleAuth", {
    web: () => import("./web").then((m) => new m.JournalGoogleAuthWeb()),
});
