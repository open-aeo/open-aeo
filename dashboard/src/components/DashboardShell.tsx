import { useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";
import { apiFetch, UnauthorizedError } from "@/lib/api";
import { logout } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sidebar, type Section } from "@/components/dashboard/Sidebar";
import { Overview } from "@/components/dashboard/Overview";
import { Prompts } from "@/components/dashboard/Prompts";
import { Competitors } from "@/components/dashboard/Competitors";
import { RunCheck, type RunPrefill } from "@/components/dashboard/RunCheck";
import { Settings } from "@/components/dashboard/Settings";

interface Me {
  userId: string;
  login: string;
}

const SECTION_META: Record<Section, { title: string; subtitle: string }> = {
  overview: {
    title: "Overview",
    subtitle: "How often answer engines cite your domain.",
  },
  prompts: {
    title: "Prompts",
    subtitle: "The questions being tracked, and how each one is trending.",
  },
  competitors: {
    title: "Competitors",
    subtitle: "Which domains the engines cite instead of yours.",
  },
  run: { title: "Run a check", subtitle: "Ask an engine now and watch it answer." },
  settings: { title: "Settings", subtitle: "Provider keys used to run your checks." },
};

export default function DashboardShell() {
  const [section, setSection] = useState<Section>("overview");
  const [me, setMe] = useState<Me | null>(null);
  const [runPrefill, setRunPrefill] = useState<RunPrefill | null>(null);

  useEffect(() => {
    apiFetch<Me>("/api/me")
      .then(setMe)
      .catch((err) => {
        if (err instanceof UnauthorizedError) window.location.href = "/";
      });
  }, []);

  const meta = SECTION_META[section];

  return (
    <div className="bg-background flex min-h-svh">
      <Sidebar
        active={section}
        onSelect={setSection}
        login={me?.login ?? null}
        onLogout={() => {
          logout();
          window.location.href = "/";
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/85 sticky top-0 z-20 flex items-center justify-between gap-4 border-b px-6 py-3 backdrop-blur">
          <div className="min-w-0">
            <h1 className="truncate text-[15px] leading-tight font-semibold tracking-tight">
              {meta.title}
            </h1>
            <p className="text-muted-foreground truncate text-xs">{meta.subtitle}</p>
          </div>
          {section !== "run" && (
            <Button size="sm" onClick={() => setSection("run")}>
              <PlayCircle />
              Run a check
            </Button>
          )}
        </header>

        <main className="min-w-0 flex-1 p-6">
          {section === "overview" && (
            <Overview
              onRun={() => {
                setRunPrefill(null);
                setSection("run");
              }}
            />
          )}
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
    </div>
  );
}
