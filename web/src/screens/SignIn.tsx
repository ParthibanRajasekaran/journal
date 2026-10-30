import { api } from "../api";

export function SignIn() {
  return (
    <main>
      <h1>Journal</h1>
      <div className="card">
        <p>Track what you eat, see today at a glance, and keep your data under your control.</p>
        <a className="button primary" href={api.signInUrl}>Continue with Google</a>
      </div>
    </main>
  );
}
