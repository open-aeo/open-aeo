import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<
  string,
  { label?: React.ReactNode; icon?: React.ComponentType; color?: string }
>;

type ChartContextProps = { config: ChartConfig };

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error("useChart must be used within a <ChartContainer />");
  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs",
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "[&_.recharts-cartesian-grid_line]:stroke-border/70",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
          "[&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          "[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/60",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

// Emits `--color-<key>` custom properties so series can be referenced as
// `var(--color-perplexity)` in JSX rather than threading colours through props.
function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, item]) => item.color);
  if (!colorConfig.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] {\n${colorConfig
          .map(([key, item]) => `  --color-${key}: ${item.color};`)
          .join("\n")}\n}`,
      }}
    />
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
  hideLabel = false,
  hideIndicator = false,
  indicator = "dot",
  className,
}: {
  active?: boolean;
  payload?: any[];
  label?: any;
  labelFormatter?: (value: any, payload: any[]) => React.ReactNode;
  formatter?: (value: any, name: string, item: any) => React.ReactNode;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: "dot" | "line";
  className?: string;
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;

  return (
    <div
      className={cn(
        "bg-popover text-popover-foreground grid min-w-[9rem] items-start gap-1.5 rounded-lg border px-2.5 py-2 text-xs shadow-md",
        className,
      )}
    >
      {!hideLabel && (
        <div className="text-muted-foreground font-medium">
          {labelFormatter ? labelFormatter(label, payload) : label}
        </div>
      )}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = String(item.dataKey ?? item.name ?? "value");
          const itemConfig = config[key];
          const color = item.color ?? item.payload?.fill;
          return (
            <div key={`${key}-${index}`} className="flex w-full items-center gap-2">
              {!hideIndicator && (
                <span
                  className={cn(
                    "shrink-0 rounded-[2px]",
                    indicator === "dot" ? "size-2 rounded-full" : "h-0.5 w-3",
                  )}
                  style={{ background: color }}
                />
              )}
              <span className="text-muted-foreground flex-1">
                {itemConfig?.label ?? item.name}
              </span>
              <span className="text-foreground tabular font-medium">
                {formatter ? formatter(item.value, key, item) : item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChartLegend = RechartsPrimitive.Legend;

function ChartLegendContent({
  payload,
  className,
}: {
  payload?: any[];
  className?: string;
}) {
  const { config } = useChart();
  if (!payload?.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-3", className)}>
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.value);
        return (
          <div key={key} className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span className="size-2 shrink-0 rounded-full" style={{ background: item.color }} />
            {config[key]?.label ?? key}
          </div>
        );
      })}
    </div>
  );
}

export {
  ChartContainer,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  useChart,
};
