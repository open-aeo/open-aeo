import { useEffect, useState } from "react";
import { apiFetch, apiPost, type KeyStatus } from "../lib/api";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: "var(--text-sm)",
  fontFamily: "var(--font-sans)",
  color: "var(--color-text-primary)",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
};

function KeyRow({
  provider,
  label,
  isSet,
  onSaved,
}: {
  provider: "perplexity" | "openai";
  label: string;
  isSet: boolean;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!value) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost("/api/keys", { provider, apiKey: value });
      setValue("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        padding: "var(--space-4)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-2)",
        }}
      >
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{label}</span>
        <span
          style={{
            fontSize: "var(--text-xs)",
            padding: "2px 8px",
            borderRadius: "var(--radius-full)",
            background: isSet ? "rgba(48, 209, 88, 0.12)" : "var(--color-surface-raised)",
            color: isSet ? "var(--color-success)" : "var(--color-text-tertiary)",
          }}
        >
          {isSet ? "Key set" : "Not set"}
        </span>
      </div>
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <input
          style={inputStyle}
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={isSet ? "Replace key…" : "Paste API key…"}
        />
        <button
          onClick={save}
          disabled={saving || !value}
          style={{
            background: "var(--color-accent)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-md)",
            padding: "0 16px",
            fontSize: "var(--text-sm)",
            fontFamily: "var(--font-sans)",
            cursor: saving || !value ? "default" : "pointer",
            opacity: saving || !value ? 0.6 : 1,
          }}
        >
          Save
        </button>
      </div>
      {error && (
        <p style={{ marginTop: "var(--space-2)", color: "var(--color-danger)", fontSize: "var(--text-xs)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export function Settings() {
  const [status, setStatus] = useState<KeyStatus | null>(null);

  function refresh() {
    apiFetch<KeyStatus>("/api/keys").then(setStatus).catch(() => {});
  }

  useEffect(refresh, []);

  return (
    <div style={{ maxWidth: 480 }}>
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--color-text-secondary)",
          marginBottom: "var(--space-4)",
        }}
      >
        Checks run against your own key, not a shared one. Keys are encrypted at
        rest and never shown again once saved.
      </p>
      <div
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-surface)",
          overflow: "hidden",
        }}
      >
        <KeyRow
          provider="perplexity"
          label="Perplexity"
          isSet={status?.perplexity ?? false}
          onSaved={refresh}
        />
        <KeyRow
          provider="openai"
          label="OpenAI (ChatGPT web search)"
          isSet={status?.openai ?? false}
          onSaved={refresh}
        />
      </div>
    </div>
  );
}
