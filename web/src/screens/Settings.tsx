import { FormEvent, useEffect, useState } from "react";
import { api, AiKeyStatus, Profile, Provider } from "../api";

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
      <TargetsForm profile={profile} onSaved={onProfile} />
      <AiKeys />
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Account</h2>
        <p className="muted">Signed in as {profile.email}</p>
        <div className="row">
          <button onClick={() => api.logout().then(onSignedOut)}>Sign out</button>
          <DeleteAccount onDeleted={onSignedOut} />
        </div>
      </section>
    </>
  );
}

function TargetsForm({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const [calories, setCalories] = useState(profile.daily_targets.calories?.toString() ?? "");
  const [protein, setProtein] = useState(profile.daily_targets.protein_g?.toString() ?? "");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      const saved = await api.updateMe({
        daily_targets: {
          calories: calories === "" ? undefined : Number(calories),
          protein_g: protein === "" ? undefined : Number(protein),
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
      <div className="row" style={{ marginTop: 12 }}>
        <span className="muted">{message}</span>
        <button type="submit" className="primary">Save targets</button>
      </div>
    </form>
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
      <h2 style={{ marginTop: 0 }}>Your AI keys</h2>
      <p className="muted">
        Use your own provider account. Your key is checked once, stored encrypted, and never shown again. Requests go to your provider under its terms.
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      <ul className="plain">
        {keys.map((key) => (
          <KeyRow key={key.provider} status={key} onChanged={load} />
        ))}
      </ul>
      {PROVIDERS.filter((p) => !keys.some((k) => k.provider === p.id)).map((p) => (
        <AddKey key={p.id} provider={p} onSaved={load} />
      ))}
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

function AddKey({ provider, onSaved }: { provider: (typeof PROVIDERS)[number]; onSaved: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!agreed) return setError("Please confirm before saving.");
    setError(null);
    setSaving(true);
    try {
      await api.saveAiKey(provider.id, apiKey.trim());
      setApiKey("");
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 12 }}>
      <label htmlFor={`key-${provider.id}`}>{provider.label}. {provider.help}</label>
      <input
        id={`key-${provider.id}`}
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
      />
      <label className="row" style={{ justifyContent: "flex-start", fontSize: 14 }}>
        <input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        I understand my requests go to this provider under its terms, on my account.
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" disabled={saving || apiKey.trim().length === 0}>{saving ? "Checking…" : "Save key"}</button>
    </form>
  );
}

function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) return <button className="danger" onClick={() => setConfirming(true)}>Delete account</button>;
  return (
    <button
      className="danger"
      onClick={async () => {
        await api.deleteAccount();
        onDeleted();
      }}
    >
      Yes, delete everything
    </button>
  );
}
