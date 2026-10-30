import { api } from "../api";

export function SignIn() {
  return (
    <main className="shell" style={{ paddingTop: 64 }}>
      <h1 style={{ fontSize: 40, background: "linear-gradient(135deg,#5eead4,#38bdf8)", WebkitBackgroundClip: "text", color: "transparent" }}>Journal</h1>
      <div className="card" style={{ maxWidth: 480 }}>
        <p>Track what you eat, see today at a glance, and keep your data under your control.</p>
        <a className="button primary" href={api.signInUrl}>Continue with Google</a>
      </div>
    </main>
  );
}
