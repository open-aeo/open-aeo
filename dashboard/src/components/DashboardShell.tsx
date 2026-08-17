import { useEffect, useState } from "react";
import {
  apiFetch,
  UnauthorizedError,
  type AeoCheckResult,
  type SourcesBreakdown,
  type TrendPoint,
} from "../lib/api";
import { logout } from "../lib/auth";
import { StatTile } from "./StatTile";
import { TrendLine } from "./TrendLine";

interface Me {
  userId: string;
  login: string;
}

export default function DashboardShell() {
  const [me, setMe] = useState<Me | null>(null);
  const [checks, setChecks] = useState<AeoCheckResult[]>([]);
  const [sources, setSources] = useState<SourcesBreakdown | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Me>("/api/me"),
      apiFetch<{ checks: AeoCheckResult[] }>("/api/checks"),
      apiFetch<SourcesBreakdown>("/api/sources"),
      apiFetch<{ trend: TrendPoint[] }>("/api/trends"),
    ])
      .then(([meRes, checksRes, sourcesRes, trendRes]) => {
        setMe(meRes);
        setChecks(checksRes.checks);
        setSources(sourcesRes);
        setTrend(trendRes.trend);
      })
      .catch((err) => {
        if (err instanceof UnauthorizedError) {
          window.location.href = "/";
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  const totalChecks = checks.length;
  const citedCount = checks.filter((c) => c.cited).length;
  const citedRate = totalChecks > 0 ? Math.round((citedCount / totalChecks) * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `0 var(--space-8)`,
          height: 56,
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "var(--text-lg)", letterSpacing: "-0.02em" }}>
          open-aeo
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          {me && (
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>
              {me.login}
            </span>
          )}
          <button
            onClick={() => {
              logout();
              window.location.href = "/";
            }}
            style={{
              background: "none",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "6px 12px",
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </div>
      </header>

      {error && (
        <div
          style={{
            margin: "var(--space-4) var(--space-8)",
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
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        <StatTile label="Checks" value={totalChecks} loading={loading} />
        <StatTile label="Cited rate" value={`${citedRate}%`} loading={loading} />
        <StatTile
          label="Competitor domains"
          value={sources?.uniqueDomains ?? 0}
          loading={loading}
        />
      </div>

      <section style={{ padding: "var(--space-6) var(--space-8)" }}>
        <h2
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--color-text-secondary)",
            marginBottom: "var(--space-3)",
          }}
        >
          Citation rate over time
        </h2>
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-surface)",
            padding: "var(--space-4)",
          }}
        >
          <TrendLine points={trend} />
        </div>
      </section>

      <section style={{ padding: "0 var(--space-8) var(--space-6)" }}>
        <h2
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--color-text-secondary)",
            marginBottom: "var(--space-3)",
          }}
        >
          Top competitor domains
        </h2>
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-surface)",
            overflow: "hidden",
          }}
        >
          {sources && sources.domains.length > 0 ? (
            sources.domains.slice(0, 8).map((d, i) => (
              <div
                key={d.domain}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-3) var(--space-4)",
                  borderBottom:
                    i < Math.min(sources.domains.length, 8) - 1
                      ? "1px solid var(--color-border)"
                      : "none",
                  fontSize: "var(--text-sm)",
                }}
              >
                <span>{d.domain}</span>
                <span style={{ color: "var(--color-text-tertiary)" }}>
                  {d.appearances} appearance{d.appearances === 1 ? "" : "s"}
                </span>
              </div>
            ))
          ) : (
            <div
              style={{
                padding: "var(--space-6)",
                textAlign: "center",
                color: "var(--color-text-tertiary)",
                fontSize: "var(--text-sm)",
              }}
            >
              No competitor domains yet.
            </div>
          )}
        </div>
      </section>

      <section style={{ padding: "0 var(--space-8) var(--space-8)" }}>
        <h2
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            color: "var(--color-text-secondary)",
            marginBottom: "var(--space-3)",
          }}
        >
          History
        </h2>
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-surface)",
            overflow: "hidden",
          }}
        >
          {checks.length === 0 ? (
            <div
              style={{
                padding: "var(--space-6)",
                textAlign: "center",
                color: "var(--color-text-tertiary)",
                fontSize: "var(--text-sm)",
              }}
            >
              No checks yet — run `aeo_check` from an MCP client to get started.
            </div>
          ) : (
            checks
              .slice()
              .reverse()
              .map((check, i) => (
                <div
                  key={`${check.query}-${check.timestamp}-${i}`}
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  <button
                    onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "var(--space-3) var(--space-4)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "var(--text-sm)",
                      color: "var(--color-text-primary)",
                      textAlign: "left",
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      <span
                        style={{
                          display: "inline-block",
                          width: 8,
                          height: 8,
                          borderRadius: "var(--radius-full)",
                          background: check.cited
                            ? "var(--color-success)"
                            : "var(--color-text-tertiary)",
                        }}
                      />
                      {check.query}
                    </span>
                    <span style={{ color: "var(--color-text-tertiary)", fontSize: "var(--text-xs)" }}>
                      {new Date(check.timestamp).toLocaleDateString()}
                    </span>
                  </button>
                  {expandedIndex === i && (
                    <div
                      style={{
                        padding: "0 var(--space-4) var(--space-4) calc(var(--space-4) + 20px)",
                        fontSize: "var(--text-xs)",
                        color: "var(--color-text-secondary)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-1)",
                      }}
                    >
                      <span>Target: {check.targetDomain}</span>
                      <span>Engine: {check.engine} ({check.model})</span>
                      <span>Position: {check.position ?? "not cited"}</span>
                      <span>
                        Citation rate: {Math.round(check.citationRate * 100)}% (
                        {check.citedCount}/{check.sampleCount} samples)
                      </span>
                      {check.competitorUrls.length > 0 && (
                        <span>Top competitor: {check.competitorUrls[0]}</span>
                      )}
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      </section>
    </div>
  );
}
