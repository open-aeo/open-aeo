import { useEffect, useState } from "react";
import { MessageSquarePlus, Play, Trash2 } from "lucide-react";
import {
  apiDelete,
  apiFetch,
  apiPost,
  UnauthorizedError,
  type RunnableEngine,
  type TrackedPrompt,
} from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "./EmptyState";
import { EnginePicker } from "./EnginePicker";
import { EngineStack } from "./EngineTag";
import { Sparkline } from "./Sparkline";
import type { RunPrefill } from "./RunCheck";

export function Prompts({ onRun }: { onRun: (prefill: RunPrefill) => void }) {
  const [prompts, setPrompts] = useState<TrackedPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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
      setOpen(false);
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

  const addPromptDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <MessageSquarePlus />
          Add prompt
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Track a prompt</DialogTitle>
          <DialogDescription>
            A question you want answer engines asked repeatedly, so its citation rate
            can be trended over time.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAdd} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-query">Query</Label>
            <Input
              id="p-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="best project management tool"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-domain">Your domain</Label>
              <Input
                id="p-domain"
                value={targetDomain}
                onChange={(e) => setTargetDomain(e.target.value)}
                placeholder="example.com"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-brand">Brand name (optional)</Label>
              <Input
                id="p-brand"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Example"
              />
            </div>
          </div>
          <EnginePicker selected={engines} onToggle={toggleEngine} />
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={adding}>
              {adding ? "Adding…" : "Add prompt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {loading
            ? "Loading…"
            : `${prompts.length} prompt${prompts.length === 1 ? "" : "s"} tracked`}
        </p>
        {addPromptDialog}
      </div>

      <Card>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : prompts.length === 0 ? (
            <EmptyState
              icon={<MessageSquarePlus className="size-4" />}
              title="No tracked prompts yet"
              description="Add the questions your buyers actually ask, and open-aeo will watch how the engines answer them."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prompt</TableHead>
                  <TableHead className="w-40">Domain</TableHead>
                  <TableHead className="w-24">Engines</TableHead>
                  <TableHead className="w-28">Last result</TableHead>
                  <TableHead className="w-28">Trend</TableHead>
                  <TableHead className="w-28 text-right">Last checked</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {prompts.map((prompt) => {
                  const last = prompt.lastResult;
                  return (
                    <TableRow key={prompt.id} className="group">
                      <TableCell className="max-w-[280px] truncate font-medium" title={prompt.query}>
                        {prompt.query}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[160px] truncate">
                        {prompt.targetDomain}
                      </TableCell>
                      <TableCell>
                        <EngineStack engines={prompt.engines} />
                      </TableCell>
                      <TableCell>
                        {last ? (
                          <Badge variant={last.cited ? "success" : "muted"}>
                            {last.cited
                              ? `Cited ${Math.round(last.citationRate * 100)}%`
                              : "Not cited"}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Never run</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="h-8 w-24">
                          <Sparkline
                            points={prompt.trend.map((p) => ({ value: p.citationRate * 100 }))}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right text-xs">
                        {last ? new Date(last.timestamp).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Run ${prompt.query}`}
                                onClick={() =>
                                  onRun({
                                    query: prompt.query,
                                    targetDomain: prompt.targetDomain,
                                    brandName: prompt.brandName ?? "",
                                    engines: prompt.engines,
                                  })
                                }
                              >
                                <Play />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Run now</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Delete ${prompt.query}`}
                                className="hover:text-destructive"
                                onClick={() => handleDelete(prompt.id)}
                              >
                                <Trash2 />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Stop tracking</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
