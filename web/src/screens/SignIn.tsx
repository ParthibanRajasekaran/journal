import { api } from "../api";

export function SignIn() {
  return (
    <main className="shell" style={{ paddingTop: 64 }}>
      <h1 style={{ fontSize: 40, color: "var(--accent)", margin: "0 0 16px" }}>Journal</h1>
      <div className="card" style={{ maxWidth: 520 }}>
        <p>Track what you eat, see today at a glance, and keep your data under your control.</p>
        <a className="button primary" href={api.signInUrl}>Continue with Google</a>
      </div>
    </main>
  );
}
