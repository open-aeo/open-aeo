import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { Globe, Swords, Target } from "lucide-react";
import { apiFetch, UnauthorizedError, type CompetitorsResponse } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { StatCard } from "./StatCard";

const shareConfig = {
  share: { label: "Share of checks", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function Competitors() {
  const [data, setData] = useState<CompetitorsResponse | null>(null);
  // undefined = "let the server pick a default"; once it responds we pin the
  // selector to whatever it picked, so switching domains afterward is fully
  // controlled by this state instead of guessed server-side again.
  const [selectedDomain, setSelectedDomain] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const qs = selectedDomain ? `?targetDomain=${encodeURIComponent(selectedDomain)}` : "";
    apiFetch<CompetitorsResponse>(`/api/competitors${qs}`)
      .then((res) => {
        setData(res);
        if (selectedDomain === undefined && res.targetDomain) {
          setSelectedDomain(res.targetDomain);
        }
      })
      .catch((err) => {
        if (err instanceof UnauthorizedError) {
          window.location.href = "/";
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [selectedDomain]);

  const topCompetitor = data?.domains[0];

  // Your own domain is charted alongside the competitors so the bar for "us"
  // can be read against theirs rather than sitting in a separate stat.
  const chartRows = useMemo(() => {
    if (!data) return [];
    const you = {
      domain: data.targetDomain ?? "You",
      share: Math.round(data.yourCitedRate * 1000) / 10,
      isYou: true,
    };
    const rivals = data.domains.slice(0, 7).map((d) => ({
      domain: d.domain,
      share: Math.round(d.shareOfChecks * 1000) / 10,
      isYou: false,
    }));
    return [you, ...rivals].sort((a, b) => b.share - a.share);
  }, [data]);

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && data.availableDomains.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Comparing</span>
          <Select value={selectedDomain ?? ""} onValueChange={setSelectedDomain}>
            <SelectTrigger size="sm" className="min-w-[220px]">
              <Globe className="text-muted-foreground size-3.5" />
              <SelectValue placeholder="Pick a domain" />
            </SelectTrigger>
            <SelectContent>
              {data.availableDomains.map((domain) => (
                <SelectItem key={domain} value={domain}>
                  {domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Your citation rate"
          value={data ? `${Math.round(data.yourCitedRate * 100)}%` : "0%"}
          icon={<Target className="size-4" />}
          loading={loading}
          hint={`Across ${data?.checksAnalysed ?? 0} checks`}
        />
        <StatCard
          label="Top competitor"
          value={
            topCompetitor ? (
              <span className="max-w-[200px] truncate text-lg" title={topCompetitor.domain}>
                {topCompetitor.domain}
              </span>
            ) : (
              "—"
            )
          }
          icon={<Swords className="size-4" />}
          loading={loading}
          hint={topCompetitor ? `${topCompetitor.appearances} appearances` : undefined}
        />
        <StatCard
          label="Their share of checks"
          value={topCompetitor ? `${Math.round(topCompetitor.shareOfChecks * 100)}%` : "0%"}
          icon={<Swords className="size-4" />}
          loading={loading}
          hint="Share of checks where this domain was cited"
        />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Share of citations</CardTitle>
            <p className="text-muted-foreground mt-1.5 text-xs">
              Your domain against the rivals engines cite on the same queries.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : chartRows.length <= 1 ? (
            <EmptyState title="Nothing to compare yet" description="Run some checks first." />
          ) : (
            <ChartContainer
              config={shareConfig}
              className="aspect-auto w-full"
              style={{ height: chartRows.length * 34 + 24 }}
            >
              <BarChart
                data={chartRows}
                layout="vertical"
                margin={{ left: 4, right: 40, top: 4, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis
                  type="category"
                  dataKey="domain"
                  tickLine={false}
                  axisLine={false}
                  width={160}
                  tickMargin={6}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent formatter={(value) => `${value}%`} />}
                />
                <Bar dataKey="share" radius={4} barSize={16} isAnimationActive={false}>
                  {chartRows.map((row) => (
                    <Cell
                      key={row.domain}
                      fill={row.isYou ? "var(--chart-1)" : "var(--chart-2)"}
                      fillOpacity={row.isYou ? 1 : 0.55}
                    />
                  ))}
                  <LabelList
                    dataKey="share"
                    position="right"
                    className="fill-muted-foreground tabular"
                    fontSize={11}
                    formatter={(value: number) => `${value}%`}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Competing domains</CardTitle>
            <p className="text-muted-foreground mt-1.5 text-xs">
              Every domain cited on the queries you track for this target.
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
          ) : !data || data.domains.length === 0 ? (
            <EmptyState
              icon={<Swords className="size-4" />}
              title={
                data && data.availableDomains.length === 0
                  ? "No checks yet"
                  : "No competing domains for this target"
              }
              description="Once an engine cites someone else on your queries, they show up here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead className="w-[34%]">Share of checks</TableHead>
                  <TableHead className="w-28 text-right">Appearances</TableHead>
                  <TableHead className="w-24 text-right">Queries</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.domains.map((d, i) => (
                  <TableRow key={d.domain}>
                    <TableCell className="max-w-[260px] truncate font-medium">
                      <span className="text-muted-foreground tabular mr-2 text-xs">{i + 1}</span>
                      {d.domain}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                          <div
                            className="bg-chart-2 h-full rounded-full"
                            style={{ width: `${Math.max(3, d.shareOfChecks * 100)}%` }}
                          />
                        </div>
                        <span className="tabular text-muted-foreground w-9 text-right text-xs">
                          {Math.round(d.shareOfChecks * 100)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground text-right">
                      {d.appearances}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{d.queries.length}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
