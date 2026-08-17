import { useEffect, useState } from "react";
import { apiFetch, UnauthorizedError, type CompetitorsResponse } from "../lib/api";
import { StatTile } from "./StatTile";

export function Competitors() {
  const [data, setData] = useState<CompetitorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<CompetitorsResponse>("/api/competitors")
      .then(setData)
      .catch((err) => {
        if (err instanceof UnauthorizedError) {
          window.location.href = "/";
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  const topCompetitor = data?.domains[0];

  return (
    <div>
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

      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-surface)",
          marginBottom: "var(--space-6)",
        }}
      >
        <StatTile
          label="Your cited rate"
          value={data ? `${Math.round(data.yourCitedRate * 100)}%` : "0%"}
          loading={loading}
        />
        <StatTile
          label="Top competitor"
          value={topCompetitor ? topCompetitor.domain : "—"}
          loading={loading}
        />
        <StatTile
          label="Top competitor's share"
          value={topCompetitor ? `${Math.round(topCompetitor.shareOfChecks * 100)}%` : "0%"}
          loading={loading}
        />
      </div>

      <div
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-surface)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "1px solid var(--color-border)",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-tertiary)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          <span style={{ flex: 1 }}>Domain</span>
          <span style={{ width: 100, textAlign: "right" }}>Share</span>
          <span style={{ width: 100, textAlign: "right" }}>Appearances</span>
          <span style={{ width: 100, textAlign: "right" }}>Queries</span>
        </div>
        {!data || data.domains.length === 0 ? (
          <div
            style={{
              padding: "var(--space-6)",
              textAlign: "center",
              color: "var(--color-text-tertiary)",
              fontSize: "var(--text-sm)",
            }}
          >
            {loading ? "Loading…" : "No competitor domains yet."}
          </div>
        ) : (
          data.domains.map((d, i) => (
            <div
              key={d.domain}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "var(--space-3) var(--space-4)",
                borderBottom:
                  i < data.domains.length - 1 ? "1px solid var(--color-border)" : "none",
                fontSize: "var(--text-sm)",
              }}
            >
              <span style={{ flex: 1 }}>{d.domain}</span>
              <span style={{ width: 100, textAlign: "right", color: "var(--color-text-secondary)" }}>
                {Math.round(d.shareOfChecks * 100)}%
              </span>
              <span style={{ width: 100, textAlign: "right", color: "var(--color-text-secondary)" }}>
                {d.appearances}
              </span>
              <span style={{ width: 100, textAlign: "right", color: "var(--color-text-secondary)" }}>
                {d.queries.length}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
