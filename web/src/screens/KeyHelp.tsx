import { FormEvent, useState } from "react";
import { api, ApiError, Provider } from "../api";

// Where each provider creates a key. We cannot fetch the key for the user: the provider only shows
// it in its own console, so the user copies it back here.
// Claude's console address has changed over time, so this links to Anthropic's own getting-started page.
export const PROVIDERS: { id: Provider; label: string; url: string; prefix: string }[] = [
  { id: "openai", label: "OpenAI", url: "https://platform.openai.com/api-keys", prefix: "sk-" },
  { id: "anthropic", label: "Claude", url: "https://docs.anthropic.com/en/api/getting-started", prefix: "sk-ant-" },
  { id: "gemini", label: "Gemini", url: "https://aistudio.google.com/app/apikey", prefix: "AIza" },
];

interface Props {
  onSaved: () => void;
}

export function KeyHelp({ onSaved }: Props) {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const chosen = PROVIDERS.find((p) => p.id === provider) ?? null;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!chosen) return setError("Choose a provider first.");
    if (!agreed) return setError("Tick the box to confirm.");
    setSaving(true);
    setError(null);
    try {
      await api.saveAiKey(chosen.id, apiKey.trim());
      onSaved();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="key-help" role="region" aria-label="Connect an AI account">
      <p className="key-help-title">Connect your AI account to estimate meals</p>
      <p className="muted">Pick the account you already use. Create a key there, then paste it below. Only you can see it.</p>

      <div className="provider-buttons">
        {PROVIDERS.map((p) => (
          <a
            key={p.id}
            className={`button provider-btn ${provider === p.id ? "chip-on" : ""}`}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setProvider(p.id)}
          >
            Get a {p.label} key ↗
          </a>
        ))}
      </div>

      {chosen && (
        <form onSubmit={save} className="key-form">
          <label htmlFor="key-paste">Paste your {chosen.label} key (starts with {chosen.prefix})</label>
          <input
            id="key-paste"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <label className="row" style={{ justifyContent: "flex-start", fontSize: 14, cursor: "pointer" }}>
            <input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            My requests go to {chosen.label}, under its terms, on my account.
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="primary" disabled={saving || apiKey.trim().length === 0}>
            {saving ? "Checking…" : "Save and estimate"}
          </button>
        </form>
      )}
    </div>
  );
}
