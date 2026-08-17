import { useEffect, useRef, useState } from "react";
import {
  apiStream,
  type AeoCheckResult,
  type RunnableEngine,
  type RunCheckStreamEvent,
} from "../lib/api";
import { inputStyle, labelStyle, fieldStyle, engineLabel } from "../lib/formStyles";
import { EngineCheckboxes } from "./EngineCheckboxes";

export interface RunPrefill {
  query: string;
  targetDomain: string;
  brandName: string;
  engines: RunnableEngine[];
}

interface LogEntry {
  text: string;
  muted?: boolean;
}

function logEntries(event: RunCheckStreamEvent): LogEntry[] {
  switch (event.type) {
    case "engine-start":
      return [{ text: `→ ${engineLabel(event.engine)}: running "${event.query}"…` }];
    case "sample": {
      const entries: LogEntry[] = [
        {
          text: `   sample ${event.sampleIndex}/${event.totalSamples} — ${
            event.cited ? "cited" : "not cited"
          } — ${event.citationCount} source${event.citationCount === 1 ? "" : "s"} in the answer`,
        },
      ];
      if (event.answerPreview) {
        entries.push({
          text: `     "${event.answerPreview.replace(/\s+/g, " ").trim().slice(0, 220)}${event.answerPreview.length > 220 ? "…" : ""}"`,
          muted: true,
        });
      }
      return entries;
    }
    case "result":
      return [
        {
          text: `✓ ${engineLabel(event.engine)}: done — ${event.result.citedCount}/${
            event.result.sampleCount
          } cited`,
        },
      ];
    case "error":
      return [{ text: `✗ error — ${event.message}` }];
    default:
      return [];
  }
}

export function RunCheck({ prefill }: { prefill?: RunPrefill | null }) {
  const [query, setQuery] = useState("");
  const [targetDomain, setTargetDomain] = useState("");
  const [brandName, setBrandName] = useState("");
  const [engines, setEngines] = useState<RunnableEngine[]>(["perplexity"]);
  const [samples, setSamples] = useState(1);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [results, setResults] = useState<AeoCheckResult[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!prefill) return;
    setQuery(prefill.query);
    setTargetDomain(prefill.targetDomain);
    setBrandName(prefill.brandName);
    setEngines(prefill.engines);
  }, [prefill]);

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
    setLog([]);
    setRunning(true);
    try {
      await apiStream<RunCheckStreamEvent>(
        "/api/run-check",
        { query, targetDomain, brandName: brandName || undefined, engines, samples },
        (event) => {
          const entries = logEntries(event);
          if (entries.length > 0) {
            setLog((prev) => [...prev, ...entries]);
            logEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }
          if (event.type === "result") {
            setResults((prev) => [event.result, ...prev]);
          } else if (event.type === "done") {
            setSkipped(event.skipped);
          } else if (event.type === "error") {
            setError(event.message);
          }
        },
      );
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
          <EngineCheckboxes selected={engines} onToggle={toggleEngine} />
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
        {(running || log.length > 0) && (
          <div style={{ marginBottom: "var(--space-6)" }}>
            <h2
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                color: "var(--color-text-secondary)",
                marginBottom: "var(--space-3)",
              }}
            >
              Activity
            </h2>
            <div
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                background: "var(--color-bg)",
                padding: "var(--space-4)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                color: "var(--color-text-secondary)",
                maxHeight: 340,
                overflowY: "auto",
              }}
            >
              {log.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.7,
                    color: entry.muted ? "var(--color-text-tertiary)" : undefined,
                    fontStyle: entry.muted ? "italic" : undefined,
                  }}
                >
                  {entry.text}
                </div>
              ))}
              {running && (
                <div style={{ color: "var(--color-text-tertiary)" }}>…</div>
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

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
