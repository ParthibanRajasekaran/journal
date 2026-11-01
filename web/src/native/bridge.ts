// Native sessions hand the API client a bearer token. In the browser all three fields stay empty and the
// HttpOnly cookie is used, so the web path does not change.
export interface NativeBridge {
  accessToken: string | null;
  refresh: (() => Promise<boolean>) | null;
  signOut: (() => Promise<void>) | null;
}

export const nativeBridge: NativeBridge = { accessToken: null, refresh: null, signOut: null };
