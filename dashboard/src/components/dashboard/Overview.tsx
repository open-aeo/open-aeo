import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Hash, Quote, Search, Trophy } from "lucide-react";
import {
  apiFetch,
  UnauthorizedError,
  type AeoCheckResult,
  type SourcesBreakdown,
  type TrendPoint,
} from "@/lib/api";
import { engineMeta } from "@/lib/engines";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "./EmptyState";
import { EngineTag } from "./EngineTag";
import { Sparkline } from "./Sparkline";
import { StatCard } from "./StatCard";

const trendConfig = {
  citationRate: { label: "Citation rate", color: "var(--chart-1)" },
} satisfies ChartConfig;

function shortDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function Overview({ onRun }: { onRun: () => void }) {
  const [checks, setChecks] = useState<AeoCheckResult[]>([]);
  const [sources, setSources] = useState<SourcesBreakdown | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<{ checks: AeoCheckResult[] }>("/api/checks"),
      apiFetch<SourcesBreakdown>("/api/sources"),
      apiFetch<{ trend: TrendPoint[] }>("/api/trends"),
    ])
      .then(([checksRes, sourcesRes, trendRes]) => {
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

  const stats = useMemo(() => {
    const total = checks.length;
    const cited = checks.filter((c) => c.cited);
    const citedRate = total > 0 ? (cited.length / total) * 100 : 0;

    const positions = cited.map((c) => c.position).filter((p): p is number => p != null);
    const avgPosition =
      positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : null;

    // Day-over-day movement, in percentage points, from the trend series the
    // API already aggregates — the raw checks are not bucketed by day.
    const last = trend.at(-1);
    const prev = trend.at(-2);
    const rateDelta =
      last && prev ? (last.citationRate - prev.citationRate) * 100 : null;

    return { total, citedCount: cited.length, citedRate, avgPosition, rateDelta };
  }, [checks, trend]);

  const trendData = useMemo(
    () =>
      trend.map((p) => ({
        date: shortDate(p.date),
        citationRate: Math.round(p.citationRate * 1000) / 10,
        checksCount: p.checksCount,
      })),
    [trend],
  );

  const sparkPoints = useMemo(
    () => trend.map((p) => ({ value: p.citationRate * 100 })),
    [trend],
  );

  const engineSplit = useMemo(() => {
    const counts = new Map<string, { total: number; cited: number }>();
    for (const check of checks) {
      const entry = counts.get(check.engine) ?? { total: 0, cited: 0 };
      entry.total += 1;
      if (check.cited) entry.cited += 1;
      counts.set(check.engine, entry);
    }
    return [...counts.entries()]
      .map(([engine, { total, cited }]) => ({
        engine,
        label: engineMeta(engine).label,
        color: engineMeta(engine).color,
        total,
        cited,
        citedRate: total > 0 ? (cited / total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [checks]);

  const engineConfig = useMemo(
    () =>
      Object.fromEntries(
        engineSplit.map((e) => [e.engine, { label: e.label, color: e.color }]),
      ) satisfies ChartConfig,
    [engineSplit],
  );

  const recentChecks = useMemo(() => checks.slice().reverse().slice(0, 12), [checks]);
  const topDomains = sources?.domains.slice(0, 8) ?? [];
  const maxAppearances = topDomains[0]?.appearances ?? 1;

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Checks run"
          value={stats.total}
          icon={<Search className="size-4" />}
          loading={loading}
          hint={`${sources?.checksAnalysed ?? 0} analysed for sources`}
        />
        <StatCard
          label="Citation rate"
          value={`${Math.round(stats.citedRate)}%`}
          delta={stats.rateDelta == null ? null : { value: stats.rateDelta, suffix: "pp" }}
          icon={<Quote className="size-4" />}
          loading={loading}
          chart={<Sparkline points={sparkPoints} />}
        />
        <StatCard
          label="Average position"
          value={stats.avgPosition == null ? "—" : stats.avgPosition.toFixed(1)}
          icon={<Hash className="size-4" />}
          loading={loading}
          hint="Across answers where you were cited (lower is better)"
        />
        <StatCard
          label="Competing domains"
          value={sources?.uniqueDomains ?? 0}
          icon={<Trophy className="size-4" />}
          loading={loading}
          hint={`${sources?.totalCompetitorUrls ?? 0} cited URLs seen`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Citation rate over time</CardTitle>
              <p className="text-muted-foreground mt-1.5 text-xs">
                Share of daily checks where an engine cited your domain.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : trendData.length === 0 ? (
              <EmptyState
                title="No checks yet"
                description="Run your first check and the trend will start here."
                action={
                  <Button size="sm" variant="outline" onClick={onRun}>
                    Run a check
                  </Button>
                }
              />
            ) : (
              <ChartContainer config={trendConfig} className="aspect-auto h-[220px] w-full">
                <AreaChart data={trendData} margin={{ left: 4, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="fillCitationRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-citationRate)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--color-citationRate)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    minTickGap={24}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    width={48}
                  />
                  <ChartTooltip
                    cursor={{ stroke: "var(--border)" }}
                    content={
                      <ChartTooltipContent formatter={(value) => `${value}%`} indicator="line" />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="citationRate"
                    stroke="var(--color-citationRate)"
                    strokeWidth={2}
                    fill="url(#fillCitationRate)"
                    dot={trendData.length === 1 ? { r: 3 } : false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Checks by engine</CardTitle>
              <p className="text-muted-foreground mt-1.5 text-xs">
                Where your checks ran, and how each engine treated you.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : engineSplit.length === 0 ? (
              <EmptyState title="No engine data yet" />
            ) : (
              <div className="flex flex-col gap-4">
                <ChartContainer config={engineConfig} className="mx-auto aspect-square h-[150px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={engineSplit}
                      dataKey="total"
                      nameKey="engine"
                      innerRadius={44}
                      outerRadius={70}
                      strokeWidth={2}
                      stroke="var(--background)"
                      isAnimationActive={false}
                    >
                      {engineSplit.map((e) => (
                        <Cell key={e.engine} fill={e.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>

                <div className="flex flex-col gap-2">
                  {engineSplit.map((e) => (
                    <div key={e.engine} className="flex items-center gap-2 text-xs">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: e.color }}
                      />
                      <EngineTag engine={e.engine} className="flex-1 truncate" />
                      <span className="tabular text-muted-foreground">
                        {e.total} · {Math.round(e.citedRate)}% cited
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Most-cited domains</CardTitle>
              <p className="text-muted-foreground mt-1.5 text-xs">
                The sources engines reach for on your tracked queries.
              </p>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {loading ? (
              <div className="flex flex-col gap-2 px-5 pb-5">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : topDomains.length === 0 ? (
              <EmptyState title="No cited domains yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead className="w-[42%]">Appearances</TableHead>
                    <TableHead className="w-20 text-right">Queries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topDomains.map((d) => (
                    <TableRow key={d.domain}>
                      <TableCell className="max-w-[200px] truncate font-medium">
                        {d.domain}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                            <div
                              className="bg-chart-1 h-full rounded-full"
                              style={{
                                width: `${Math.max(4, (d.appearances / maxAppearances) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="tabular text-muted-foreground w-6 text-right text-xs">
                            {d.appearances}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="tabular text-muted-foreground text-right">
                        {d.queries.length}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent checks</CardTitle>
              <p className="text-muted-foreground mt-1.5 text-xs">
                The last {recentChecks.length || "few"} runs across every engine.
              </p>
            </div>
            <CardAction>
              <Button size="xs" variant="outline" onClick={onRun}>
                New check
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {loading ? (
              <div className="flex flex-col gap-2 px-5 pb-5">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : recentChecks.length === 0 ? (
              <EmptyState
                title="Nothing has run yet"
                description="Checks appear here as soon as an engine answers."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Query</TableHead>
                    <TableHead className="w-32">Engine</TableHead>
                    <TableHead className="w-24">Result</TableHead>
                    <TableHead className="w-16 text-right">Pos.</TableHead>
                    <TableHead className="w-20 text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentChecks.map((check, i) => (
                    <TableRow key={`${check.query}-${check.timestamp}-${i}`}>
                      <TableCell
                        className="max-w-[220px] truncate font-medium"
                        title={check.query}
                      >
                        {check.query}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <EngineTag engine={check.engine} />
                      </TableCell>
                      <TableCell>
                        <Badge variant={check.cited ? "success" : "muted"}>
                          {check.cited
                            ? `Cited ${Math.round(check.citationRate * 100)}%`
                            : "Not cited"}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular text-muted-foreground text-right">
                        {check.position ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-right text-xs">
                        {shortDate(check.timestamp)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
