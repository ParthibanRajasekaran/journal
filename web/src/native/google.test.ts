import { describe, expect, it, vi } from "vitest";
import { GoogleSignInError, googleIdToken, missingConfiguration, nativeSignInReady, type GoogleConfig } from "./google";

const ios: GoogleConfig = { platform: "ios", webClientId: "web.apps.googleusercontent.com", iosClientId: "ios.apps.googleusercontent.com" };
const android: GoogleConfig = { platform: "android", webClientId: "web.apps.googleusercontent.com", iosClientId: "" };

describe("configuration", () => {
  it("names the missing web client ID, and needs no iOS client ID on Android", () => {
    expect(missingConfiguration({ ...android, webClientId: "" })).toContain("VITE_GOOGLE_WEB_CLIENT_ID");
    expect(missingConfiguration(android)).toBeNull();
    expect(nativeSignInReady(android)).toBe(true);
  });

  it("requires the iOS client ID on iOS, and says so", () => {
    expect(missingConfiguration({ ...ios, iosClientId: "" })).toContain("VITE_GOOGLE_IOS_CLIENT_ID");
    expect(nativeSignInReady({ ...ios, iosClientId: "" })).toBe(false);
  });

  it("is never ready in a browser", () => {
    expect(nativeSignInReady({ ...android, platform: "web" })).toBe(false);
  });
});

describe("login through the plugin", () => {
  it("passes the nonce, the web client ID and, on iOS only, the iOS client ID", async () => {
    const login = vi.fn(async () => ({ idToken: "token-value" }));
    await expect(googleIdToken({ login }, ios, "nonce-1")).resolves.toBe("token-value");
    expect(login).toHaveBeenCalledWith({ nonce: "nonce-1", webClientId: ios.webClientId, iosClientId: ios.iosClientId });
    await googleIdToken({ login }, android, "nonce-2");
    expect(login).toHaveBeenLastCalledWith({ nonce: "nonce-2", webClientId: android.webClientId, iosClientId: undefined });
  });

  it("refuses to call the plugin when configuration is missing", async () => {
    const login = vi.fn();
    await expect(googleIdToken({ login }, { ...ios, iosClientId: "" }, "n")).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    expect(login).not.toHaveBeenCalled();
  });

  it("normalises every native cancellation and failure to a known code", async () => {
    const cancelled = Object.assign(new Error("sign-in was cancelled"), { code: "USER_CANCELLED" });
    await expect(googleIdToken({ login: async () => { throw cancelled; } }, android, "n")).rejects.toMatchObject({ code: "USER_CANCELLED" });
    const unknown = Object.assign(new Error("Developer console is not set up correctly"), { code: "SOMETHING_ELSE" });
    await expect(googleIdToken({ login: async () => { throw unknown; } }, android, "n")).rejects.toMatchObject({ code: "FAILED" });
    await expect(googleIdToken({ login: async () => { throw new Error("plain"); } }, android, "n")).rejects.toMatchObject({ code: "FAILED" });
  });

  it("treats a result without an ID token as a failure, never as a sign-in", async () => {
    await expect(googleIdToken({ login: async () => ({ idToken: "" }) }, android, "n")).rejects.toBeInstanceOf(GoogleSignInError);
    await expect(googleIdToken({ login: async () => ({}) as { idToken: string } }, android, "n")).rejects.toMatchObject({ code: "FAILED" });
  });
});
