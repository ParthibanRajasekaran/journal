import { FormEvent, useEffect, useId, useState } from "react";
import { api, AiKeyStatus, Profile, Provider } from "../api";
import { PROVIDERS as KEY_PAGES } from "./KeyHelp";
import { discardOwner } from "../offline";

interface Props {
  profile: Profile;
  onProfile: (profile: Profile) => void;
  onSignedOut: () => void;
}

const PROVIDERS: { id: Provider; label: string; help: string }[] = [
  { id: "openai", label: "OpenAI", help: "Keys start with sk-." },
  { id: "anthropic", label: "Anthropic (Claude)", help: "Keys start with sk-ant-." },
  { id: "gemini", label: "Google Gemini", help: "Keys start with AIza." },
];

export function Settings({ profile, onProfile, onSignedOut }: Props) {
  return (
    <>
      <h1>Settings</h1>
      <div className="settings-grid">
        <div>
          <TargetsForm profile={profile} onSaved={onProfile} />
          <EncouragementCard profile={profile} onSaved={onProfile} />
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Account</h2>
            <p className="muted">Signed in as {profile.email}</p>
            <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
              <button onClick={() => api.logout().then(onSignedOut)}>Sign out</button>
              <DeleteAccount owner={profile.id} onDeleted={onSignedOut} />
            </div>
          </section>
        </div>
        <div>
          <AiKeys />
        </div>
      </div>
    </>
  );
}

function TargetsForm({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const [calories, setCalories] = useState(profile.daily_targets.calories?.toString() ?? "");
  const [protein, setProtein] = useState(profile.daily_targets.protein_g?.toString() ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // Checked before anything is sent, so an out-of-range number never reaches the server.
  function rangeProblem(): string | null {
    if (calories !== "" && (!Number.isFinite(Number(calories)) || Number(calories) < 800 || Number(calories) > 6000)) {
      return "Calories must be between 800 and 6000.";
    }
    if (protein !== "" && (!Number.isFinite(Number(protein)) || Number(protein) < 0 || Number(protein) > 400)) {
      return "Protein must be between 0 and 400 grams.";
    }
    return null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const failure = rangeProblem();
    setProblem(failure);
    if (failure) return;
    try {
      const saved = await api.updateMe({
        // An empty field clears that target.
        daily_targets: {
          calories: calories === "" ? null : Number(calories),
          protein_g: protein === "" ? null : Number(protein),
        },
      });
      onSaved(saved);
      setMessage("Saved.");
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2 style={{ marginTop: 0 }}>Daily targets</h2>
      <label htmlFor="cal">Calories (800–6000)</label>
      <input id="cal" inputMode="numeric" value={calories} onChange={(e) => setCalories(e.target.value)} />
      <label htmlFor="prot">Protein, grams (0–400)</label>
      <input id="prot" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />
      <p className="muted fine-print" style={{ textAlign: "left" }}>Leave a field empty to clear that target.</p>
      <div className="row" style={{ marginTop: 12 }}>
        {problem ? (
          <span className="error" role="alert">{problem}</span>
        ) : (
          <span className="muted" role="status">{message}</span>
        )}
        <button type="submit" className="primary">Save targets</button>
      </div>
    </form>
  );
}

// The buddy switch. It saves at once, and off hides every encouragement element.
function EncouragementCard({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const [message, setMessage] = useState<string | null>(null);

  async function toggle(on: boolean) {
    setMessage(null);
    try {
      onSaved(await api.updateMe({ encouragement_enabled: on }));
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Encouragement</h2>
      <label className="switch-row">
        <span>
          <strong>Show encouragement</strong>
          <span className="muted">
            {" "}A gentle note when you log, and when you reach a protein goal. Turn it off to hide every note.
          </span>
        </span>
        <span className="toggle">
          <input
            type="checkbox"
            role="switch"
            aria-label="Show encouragement"
            checked={profile.encouragement_enabled}
            onChange={(e) => void toggle(e.target.checked)}
          />
          <span className="toggle-track" aria-hidden="true" />
        </span>
      </label>
      {message && <p className="error" role="alert">{message}</p>}
    </section>
  );
}

function AiKeys() {
  const [keys, setKeys] = useState<AiKeyStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.aiKeys().then(setKeys).catch((err: Error) => setError(err.message));
  useEffect(() => {
    load();
  }, []);

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: "flex-start" }}>
        <h2 style={{ marginTop: 0 }}>Your AI key</h2>
        <InfoTip label="What is an AI key?">
          <p style={{ marginTop: 0 }}>
            Journal can estimate what's in a meal for you. To do that, it needs access to an AI service.
            Instead of using ours, you connect your own account with OpenAI, Anthropic (Claude), or Google Gemini.
          </p>
          <p>
            The key is a code your provider gives you, like a password for their service. It lets Journal make
            requests on your account, so you pay your provider directly for what you use.
          </p>
          <p style={{ marginBottom: 0 }}>
            We check the key once, store it encrypted, and never show it again. You can remove it at any time.
          </p>
        </InfoTip>
      </div>
      <p className="muted">Your key is checked once, stored encrypted, and never shown again.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {keys.length > 0 ? (
        <ul className="plain">
          {keys.map((key) => (
            <KeyRow key={key.provider} status={key} onChanged={load} />
          ))}
        </ul>
      ) : (
        <p className="muted">No AI key connected yet. Meal estimates need one.</p>
      )}
      <AddKey onSaved={load} />
    </section>
  );
}

function KeyRow({ status, onChanged }: { status: AiKeyStatus; onChanged: () => void }) {
  const label = PROVIDERS.find((p) => p.id === status.provider)?.label ?? status.provider;
  async function remove() {
    await api.deleteAiKey(status.provider);
    onChanged();
  }
  return (
    <li className="row">
      <span>
        <strong>{label}</strong> <span className="muted">key ending {status.last4}</span>
      </span>
      <button className="danger" onClick={remove}>Remove</button>
    </li>
  );
}

function AddKey({ onSaved }: { onSaved: () => void }) {
  const [provider, setProvider] = useState<Provider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const selected = PROVIDERS.find((p) => p.id === provider)!;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!agreed) return setError("Please tick the box to confirm.");
    setError(null);
    setSaving(true);
    try {
      await api.saveAiKey(provider, apiKey.trim(), agreed);
      setApiKey("");
      setAgreed(false);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 12 }}>
      <div className="provider-buttons">
        {KEY_PAGES.map((p) => (
          <a key={p.id} className="button provider-btn" href={p.url} target="_blank" rel="noopener noreferrer">
            Get a {p.label} key ↗
          </a>
        ))}
      </div>
      <label htmlFor="ai-provider">Provider</label>
      <select id="ai-provider" value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
        {PROVIDERS.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
      <label htmlFor="ai-key">Your key. {selected.help}</label>
      <input
        id="ai-key"
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />
      <label className="row" style={{ justifyContent: "flex-start", fontSize: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          Send my meal descriptions to {selected.label} to make estimates. {selected.label}&apos;s terms govern how it
          uses them.
        </span>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="primary" style={{ marginTop: 12 }} disabled={saving || apiKey.trim().length === 0 || !agreed}>
        {saving ? "Checking…" : "Save key"}
      </button>
    </form>
  );
}

function DeleteAccount({ owner, onDeleted }: { owner: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return <button className="danger" onClick={() => setConfirming(true)}>Delete account</button>;
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount();
      // Meals still waiting on this device belong to the deleted account. Drop them now, so they
      // cannot be sent after the account no longer exists.
      discardOwner(owner);
      onDeleted();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="confirm" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-body">
      <h3 id="confirm-title">Delete your account?</h3>
      <p id="confirm-body" className="muted">
        This permanently removes your account, every meal you've logged, and your saved AI key. It cannot be undone.
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button autoFocus onClick={() => setConfirming(false)} disabled={busy}>Keep my account</button>
        <button className="danger-solid" onClick={remove} disabled={busy}>
          {busy ? "Deleting…" : "Yes, delete everything"}
        </button>
      </div>
    </div>
  );
}

function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span style={{ position: "relative", display: "inline-block", marginTop: 8 }}>
      <button
        type="button"
        className="ghost icon-btn"
        style={{ width: 32, minHeight: 32, fontSize: 15, padding: 0 }}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        ⓘ
      </button>
      {open && (
        <div id={id} role="note" className="card info-panel">
          {children}
        </div>
      )}
    </span>
  );
}
