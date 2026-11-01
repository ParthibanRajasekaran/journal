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
  plugins: {
    // The WebView cannot call the API across origins (no CORS grant, and cookies are not sent cross-site).
    // This routes window.fetch and XMLHttpRequest through the native HTTP stack, which has no CORS limit.
    // Cookies are not used by the native session, which sends a bearer token.
    CapacitorHttp: { enabled: true },
  },
};

export default config;
