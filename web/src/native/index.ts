// The native sign-in wired to the real API and the device plugins.
import { api } from "../api";
import { createNativeAuth, type AttemptResponse } from "./auth";
import { googleLogin, secureStorage } from "./platform";

export const nativeAuth = createNativeAuth({
  createAttempt: () => api.createNativeAttempt() as Promise<AttemptResponse>,
  cancelAttempt: (secret) => api.cancelNativeAttempt(secret),
  complete: (secret, idToken, adult) => api.completeNativeSignIn(secret, idToken, adult),
  refresh: (refreshToken) => api.refreshNativeSession(refreshToken),
  logout: (refreshToken) => api.logoutNative(refreshToken),
  googleLogin,
  storage: secureStorage,
});
