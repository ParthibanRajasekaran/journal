// The account this browser session belongs to, as last confirmed by the server (the profile the app
// loaded). Work queued for another account must never be sent while this session is in use.
let owner: string | null = null;

export function setSessionOwner(id: string | null): void {
  owner = id;
}

export function sessionOwner(): string | null {
  return owner;
}
