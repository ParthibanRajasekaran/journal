import { useEffect, useState } from "react";
import { api } from "../api";

// Shown when sign-in cannot start, or when Google or the server sends the user back with a failure.
export function SignIn() {
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adult, setAdult] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("signin") === "failed") {
      setFailed(true);
      // Remove the marker, so a refresh does not show the message again.
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return (
    <main className="shell signin">
      <h1 className="signin-title">Journal</h1>
      <p className="tagline">A calmer way to see what you eat.</p>

      <section className="card signin-card">
        {failed && (
          <p className="error" role="alert">
            Sign-in didn't finish. Please try again.
          </p>
        )}

        <ul className="promises">
          <li>Your meal notes are yours. Estimates use only the AI account you choose.</li>
          <li>We never sell your data.</li>
          <li>Delete everything, any time, from Settings.</li>
        </ul>

        <label className="adult-check">
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
          <span>I am 18 or older.</span>
        </label>

        <a
          className={`google-btn ${adult ? "" : "is-disabled"}`}
          href={adult ? api.signInUrl : undefined}
          aria-disabled={!adult}
          // Stays reachable by keyboard while disabled, so its state can be heard and understood.
          tabIndex={0}
          aria-busy={busy}
          onClick={(e) => {
            if (!adult) return e.preventDefault();
            setBusy(true);
          }}
        >
          <GoogleMark />
          <span>{busy ? "Redirecting…" : "Continue with Google"}</span>
        </a>

        <p className="muted fine-print">We use your Google account only to confirm it's you.</p>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
