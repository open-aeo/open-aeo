import { useState } from "react";
import { apiPost, type AeoCheckResult, type RunnableEngine } from "../lib/api";

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

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-xs)",
  color: "var(--color-text-secondary)",
  marginBottom: "var(--space-1)",
};

const fieldStyle: React.CSSProperties = { marginBottom: "var(--space-4)" };

const ENGINE_OPTIONS: { value: RunnableEngine; label: string }[] = [
  { value: "perplexity", label: "Perplexity" },
  { value: "chatgpt", label: "ChatGPT (web search)" },
];

export function RunCheck() {
  const [query, setQuery] = useState("");
  const [targetDomain, setTargetDomain] = useState("");
  const [brandName, setBrandName] = useState("");
  const [engines, setEngines] = useState<RunnableEngine[]>(["perplexity"]);
  const [samples, setSamples] = useState(1);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [results, setResults] = useState<AeoCheckResult[]>([]);

  function toggleEngine(value: RunnableEngine) {
    setEngines((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (engines.length === 0) {
      setError("Pick at least one engine.");
      return;
    }
    setError(null);
    setSkipped([]);
    setRunning(true);
    try {
      const { results: newResults, skipped: newSkipped } = await apiPost<{
        results: AeoCheckResult[];
        skipped: string[];
      }>("/api/run-check", {
        query,
        targetDomain,
        brandName: brandName || undefined,
        engines,
        samples,
      });
      setResults((prev) => [...newResults, ...prev]);
      setSkipped(newSkipped);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: "var(--space-8)", alignItems: "flex-start" }}>
      <form
        onSubmit={handleSubmit}
        style={{
          flex: "0 0 320px",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-surface)",
          padding: "var(--space-6)",
        }}
      >
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="query">
            Query
          </label>
          <input
            id="query"
            style={inputStyle}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="best project management tool"
            required
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="targetDomain">
            Your domain
          </label>
          <input
            id="targetDomain"
            style={inputStyle}
            value={targetDomain}
            onChange={(e) => setTargetDomain(e.target.value)}
            placeholder="example.com"
            required
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="brandName">
            Brand name (optional)
          </label>
          <input
            id="brandName"
            style={inputStyle}
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Example"
          />
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Engines</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {ENGINE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  fontSize: "var(--text-sm)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={engines.includes(opt.value)}
                  onChange={() => toggleEngine(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="samples">
            Samples ({samples})
          </label>
          <input
            id="samples"
            type="range"
            min={1}
            max={10}
            value={samples}
            onChange={(e) => setSamples(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <button
          type="submit"
          disabled={running}
          style={{
            width: "100%",
            background: running ? "var(--color-border-strong)" : "var(--color-accent)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-md)",
            padding: "10px",
            fontSize: "var(--text-sm)",
            fontFamily: "var(--font-sans)",
            cursor: running ? "default" : "pointer",
          }}
        >
          {running ? "Running…" : "Run check"}
        </button>

        {error && (
          <p
            style={{
              marginTop: "var(--space-3)",
              color: "var(--color-danger)",
              fontSize: "var(--text-xs)",
            }}
          >
            {error}
          </p>
        )}
        {skipped.length > 0 && (
          <p
            style={{
              marginTop: "var(--space-3)",
              color: "var(--color-warning)",
              fontSize: "var(--text-xs)",
            }}
          >
            Skipped {skipped.join(", ")} — no key set. Add one in Settings.
          </p>
        )}
      </form>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h2
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--color-text-secondary)",
            marginBottom: "var(--space-3)",
          }}
        >
          Results
        </h2>
        {results.length === 0 ? (
          <div
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              background: "var(--color-surface)",
              padding: "var(--space-8)",
              textAlign: "center",
              color: "var(--color-text-tertiary)",
              fontSize: "var(--text-sm)",
            }}
          >
            Fill in the form and run a check to see results here.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {results.map((result, i) => (
              <div
                key={`${result.timestamp}-${i}`}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--color-surface)",
                  padding: "var(--space-4)",
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
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                    {result.query}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-xs)",
                      padding: "2px 8px",
                      borderRadius: "var(--radius-full)",
                      background: result.cited
                        ? "rgba(48, 209, 88, 0.12)"
                        : "var(--color-surface-raised)",
                      color: result.cited ? "var(--color-success)" : "var(--color-text-tertiary)",
                    }}
                  >
                    {result.cited ? "Cited" : "Not cited"}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-1)",
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <span>
                    {result.engine} ({result.model}) — {result.targetDomain}
                  </span>
                  <span>
                    Position: {result.position ?? "n/a"} — rate{" "}
                    {Math.round(result.citationRate * 100)}% ({result.citedCount}/
                    {result.sampleCount} samples)
                  </span>
                  {result.competitorUrls.length > 0 && (
                    <span>Top competitor: {result.competitorUrls[0]}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
