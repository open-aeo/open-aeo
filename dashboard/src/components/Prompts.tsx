import { useEffect, useState } from "react";
import {
  apiDelete,
  apiFetch,
  apiPost,
  UnauthorizedError,
  type RunnableEngine,
  type TrackedPrompt,
} from "../lib/api";
import { inputStyle, labelStyle, fieldStyle, engineLabel } from "../lib/formStyles";
import { EngineCheckboxes } from "./EngineCheckboxes";
import { TrendLine } from "./TrendLine";
import type { RunPrefill } from "./RunCheck";

export function Prompts({ onRun }: { onRun: (prefill: RunPrefill) => void }) {
  const [prompts, setPrompts] = useState<TrackedPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [targetDomain, setTargetDomain] = useState("");
  const [brandName, setBrandName] = useState("");
  const [engines, setEngines] = useState<RunnableEngine[]>(["perplexity"]);
  const [adding, setAdding] = useState(false);

  function refresh() {
    setLoading(true);
    apiFetch<{ prompts: TrackedPrompt[] }>("/api/prompts")
      .then((res) => setPrompts(res.prompts))
      .catch((err) => {
        if (err instanceof UnauthorizedError) {
          window.location.href = "/";
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  function toggleEngine(value: RunnableEngine) {
    setEngines((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value],
    );
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (engines.length === 0) {
      setError("Pick at least one engine.");
      return;
    }
    setError(null);
    setAdding(true);
    try {
      await apiPost("/api/prompts", {
        query,
        targetDomain,
        brandName: brandName || undefined,
        engines,
      });
      setQuery("");
      setTargetDomain("");
      setBrandName("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiDelete(`/api/prompts/${id}`);
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div>
      <form
        onSubmit={handleAdd}
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-surface)",
          padding: "var(--space-6)",
          marginBottom: "var(--space-6)",
          display: "flex",
          gap: "var(--space-4)",
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div style={{ ...fieldStyle, flex: "1 1 200px", marginBottom: 0 }}>
          <label style={labelStyle} htmlFor="p-query">
            Query
          </label>
          <input
            id="p-query"
            style={inputStyle}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="best project management tool"
            required
          />
        </div>
        <div style={{ ...fieldStyle, flex: "1 1 160px", marginBottom: 0 }}>
          <label style={labelStyle} htmlFor="p-domain">
            Your domain
          </label>
          <input
            id="p-domain"
            style={inputStyle}
            value={targetDomain}
            onChange={(e) => setTargetDomain(e.target.value)}
            placeholder="example.com"
            required
          />
        </div>
        <div style={{ ...fieldStyle, flex: "1 1 160px", marginBottom: 0 }}>
          <label style={labelStyle} htmlFor="p-brand">
            Brand (optional)
          </label>
          <input
            id="p-brand"
            style={inputStyle}
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Example"
          />
        </div>
        <div style={{ marginBottom: 0 }}>
          <EngineCheckboxes selected={engines} onToggle={toggleEngine} />
        </div>
        <button
          type="submit"
          disabled={adding}
          style={{
            background: "var(--color-accent)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-md)",
            padding: "10px 20px",
            fontSize: "var(--text-sm)",
            fontFamily: "var(--font-sans)",
            cursor: adding ? "default" : "pointer",
            opacity: adding ? 0.6 : 1,
          }}
        >
          Add prompt
        </button>
      </form>

      {error && (
        <div
          style={{
            marginBottom: "var(--space-4)",
            padding: "var(--space-3) var(--space-4)",
            border: "1px solid var(--color-danger)",
            borderRadius: "var(--radius-md)",
            color: "var(--color-danger)",
            fontSize: "var(--text-sm)",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: "var(--color-text-tertiary)", fontSize: "var(--text-sm)" }}>
          Loading…
        </div>
      ) : prompts.length === 0 ? (
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
          No tracked prompts yet — add one above.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                background: "var(--color-surface)",
                padding: "var(--space-4)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-4)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    marginBottom: "var(--space-1)",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: "var(--radius-full)",
                      background: prompt.lastResult?.cited
                        ? "var(--color-success)"
                        : "var(--color-text-tertiary)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                    {prompt.query}
                  </span>
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                  {prompt.targetDomain} · {prompt.engines.map(engineLabel).join(", ")} ·{" "}
                  {prompt.lastResult
                    ? `last checked ${new Date(prompt.lastResult.timestamp).toLocaleDateString()}`
                    : "never checked"}
                </div>
              </div>

              <div style={{ width: 140, flexShrink: 0 }}>
                <TrendLine points={prompt.trend} />
              </div>

              <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>
                <button
                  onClick={() =>
                    onRun({
                      query: prompt.query,
                      targetDomain: prompt.targetDomain,
                      brandName: prompt.brandName ?? "",
                      engines: prompt.engines,
                    })
                  }
                  style={{
                    background: "var(--color-accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    padding: "6px 14px",
                    fontSize: "var(--text-xs)",
                    fontFamily: "var(--font-sans)",
                    cursor: "pointer",
                  }}
                >
                  Run
                </button>
                <button
                  onClick={() => handleDelete(prompt.id)}
                  style={{
                    background: "none",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    padding: "6px 14px",
                    fontSize: "var(--text-xs)",
                    color: "var(--color-text-secondary)",
                    fontFamily: "var(--font-sans)",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
