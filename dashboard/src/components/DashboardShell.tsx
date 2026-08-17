import { useEffect, useState } from "react";
import { apiFetch, UnauthorizedError } from "../lib/api";
import { logout } from "../lib/auth";
import { Sidebar, type Section } from "./Sidebar";
import { Overview } from "./Overview";
import { RunCheck, type RunPrefill } from "./RunCheck";
import { Settings } from "./Settings";
import { Prompts } from "./Prompts";
import { Competitors } from "./Competitors";

interface Me {
  userId: string;
  login: string;
}

const SECTION_TITLES: Record<Section, string> = {
  overview: "Overview",
  prompts: "Prompts",
  competitors: "Competitors",
  run: "Run a check",
  settings: "Settings",
};

export default function DashboardShell() {
  const [section, setSection] = useState<Section>("overview");
  const [me, setMe] = useState<Me | null>(null);
  const [runPrefill, setRunPrefill] = useState<RunPrefill | null>(null);

  useEffect(() => {
    apiFetch<Me>("/api/me")
      .then(setMe)
      .catch((err) => {
        if (err instanceof UnauthorizedError) {
          window.location.href = "/";
        }
      });
  }, []);

  return (
    <div style={{ display: "flex", background: "var(--color-bg)", minHeight: "100vh" }}>
      <Sidebar
        active={section}
        onSelect={setSection}
        login={me?.login ?? null}
        onLogout={() => {
          logout();
          window.location.href = "/";
        }}
      />
      <main style={{ flex: 1, minWidth: 0, padding: "var(--space-8)" }}>
        <h1
          style={{
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            marginBottom: "var(--space-6)",
          }}
        >
          {SECTION_TITLES[section]}
        </h1>
        {section === "overview" && <Overview />}
        {section === "prompts" && (
          <Prompts
            onRun={(prefill) => {
              setRunPrefill(prefill);
              setSection("run");
            }}
          />
        )}
        {section === "competitors" && <Competitors />}
        {section === "run" && <RunCheck prefill={runPrefill} />}
        {section === "settings" && <Settings />}
      </main>
    </div>
  );
}
