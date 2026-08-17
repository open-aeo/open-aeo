import { useEffect, useState } from "react";
import { apiFetch, UnauthorizedError } from "../lib/api";
import { logout } from "../lib/auth";
import { Sidebar, type Section } from "./Sidebar";
import { Overview } from "./Overview";
import { RunCheck } from "./RunCheck";
import { Settings } from "./Settings";

interface Me {
  userId: string;
  login: string;
}

const SECTION_TITLES: Record<Section, string> = {
  overview: "Overview",
  run: "Run a check",
  settings: "Settings",
};

export default function DashboardShell() {
  const [section, setSection] = useState<Section>("overview");
  const [me, setMe] = useState<Me | null>(null);

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
        {section === "run" && <RunCheck />}
        {section === "settings" && <Settings />}
      </main>
    </div>
  );
}
