import type { CapacitorConfig } from "@capacitor/cli";

// The native shells package the canonical web client only. webDir is the Vite output of this
// directory. Cleartext HTTP is off: the API must be reached over HTTPS in every native build.
const config: CapacitorConfig = {
  appId: "com.journal.nutrition",
  appName: "Journal",
  webDir: "dist",
  server: {
    androidScheme: "https",
    cleartext: false,
  },
};

export default config;
