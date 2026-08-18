import { useEffect, useRef, useState } from "react";
import { Loader2, PlayCircle, Terminal } from "lucide-react";
import {
  apiStream,
  type AeoCheckResult,
  type RunCheckStreamEvent,
  type RunnableEngine,
} from "@/lib/api";
import { engineLabel, engineMeta } from "@/lib/engines";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { EmptyState } from "./EmptyState";
import { EnginePicker } from "./EnginePicker";
import { EngineTag } from "./EngineTag";

export interface RunPrefill {
  query: string;
  targetDomain: string;
  brandName: string;
  engines: RunnableEngine[];
}

interface LogEntry {
  text: string;
  tone?: "muted" | "success" | "error";
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
          text: `     "${event.answerPreview.replace(/\s+/g, " ").trim().slice(0, 220)}${
            event.answerPreview.length > 220 ? "…" : ""
          }"`,
          tone: "muted",
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
          tone: "success",
        },
      ];
    case "error":
      return [{ text: `✗ error — ${event.message}`, tone: "error" }];
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
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
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
    setProgress({ done: 0, total: engines.length * samples });
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
          if (event.type === "sample") {
            setProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
          } else if (event.type === "result") {
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
      setProgress(null);
    }
  }

  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Check setup</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="query">Query</Label>
              <Input
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="best project management tool"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="targetDomain">Your domain</Label>
              <Input
                id="targetDomain"
                value={targetDomain}
                onChange={(e) => setTargetDomain(e.target.value)}
                placeholder="example.com"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brandName">Brand name (optional)</Label>
              <Input
                id="brandName"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Example"
              />
            </div>

            <EnginePicker selected={engines} onToggle={toggleEngine} />

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="samples">Samples per engine</Label>
                <span className="tabular text-muted-foreground text-xs">{samples}</span>
              </div>
              <Slider
                id="samples"
                min={1}
                max={10}
                step={1}
                value={[samples]}
                onValueChange={([value]) => setSamples(value ?? 1)}
              />
              <p className="text-muted-foreground text-[11px]">
                Engines answer differently run to run — more samples give a steadier
                citation rate, at more API cost.
              </p>
            </div>

            <Button type="submit" disabled={running}>
              {running ? <Loader2 className="animate-spin" /> : <PlayCircle />}
              {running ? "Running…" : "Run check"}
            </Button>

            {progress && (
              <div className="flex flex-col gap-1.5">
                <Progress value={pct} />
                <span className="text-muted-foreground tabular text-[11px]">
                  {progress.done} of {progress.total} samples
                </span>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {skipped.length > 0 && (
              <Alert variant="warning">
                <AlertDescription>
                  Skipped {skipped.map(engineLabel).join(", ")} — no key set. Add one in
                  Settings.
                </AlertDescription>
              </Alert>
            )}
          </form>
        </CardContent>
      </Card>

      <div className="flex min-w-0 flex-col gap-5">
        {(running || log.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="text-muted-foreground size-3.5" />
                Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/40 max-h-[340px] overflow-y-auto rounded-lg border p-3 font-mono text-[11px] leading-relaxed">
                {log.map((entry, i) => (
                  <div
                    key={i}
                    className={
                      entry.tone === "muted"
                        ? "text-muted-foreground/70 italic whitespace-pre-wrap"
                        : entry.tone === "success"
                          ? "text-success whitespace-pre-wrap"
                          : entry.tone === "error"
                            ? "text-destructive whitespace-pre-wrap"
                            : "text-foreground/80 whitespace-pre-wrap"
                    }
                  >
                    {entry.text}
                  </div>
                ))}
                {running && <div className="text-muted-foreground">…</div>}
                <div ref={logEndRef} />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <EmptyState
                icon={<PlayCircle className="size-4" />}
                title="No results yet"
                description="Fill in the form and run a check — each engine's verdict lands here."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {results.map((result, i) => {
                  const meta = engineMeta(result.engine);
                  return (
                    <div
                      key={`${result.timestamp}-${i}`}
                      className="rounded-lg border p-3.5"
                      style={{ borderLeft: `3px solid ${meta.color}` }}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <span className="text-sm font-medium">{result.query}</span>
                        <Badge variant={result.cited ? "success" : "muted"}>
                          {result.cited ? "Cited" : "Not cited"}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <EngineTag engine={result.engine} />
                        <span className="font-mono text-[11px]">{result.model}</span>
                        <span>{result.targetDomain}</span>
                        <span className="tabular">
                          Position {result.position ?? "—"}
                        </span>
                        <span className="tabular">
                          {Math.round(result.citationRate * 100)}% ({result.citedCount}/
                          {result.sampleCount} samples)
                        </span>
                      </div>
                      {result.competitorUrls.length > 0 && (
                        <p className="text-muted-foreground mt-2 truncate text-xs">
                          Top competing source:{" "}
                          <span className="text-foreground">{result.competitorUrls[0]}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
