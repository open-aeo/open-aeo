import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

/*
 * A trend glyph, not a chart: no axes, no tooltip, no legend. It sits inside a
 * stat card or a table row where the number next to it carries the meaning, so
 * anything more would be noise.
 */
export function Sparkline({
  points,
  color = "var(--chart-1)",
  className,
}: {
  points: { value: number }[];
  color?: string;
  className?: string;
}) {
  if (points.length < 2) {
    return (
      <div
        className={
          "text-muted-foreground/60 flex h-full items-center text-[11px] " + (className ?? "")
        }
      >
        —
      </div>
    );
  }

  const id = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <ResponsiveContainer width="100%" height="100%" className={className}>
      <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[0, "dataMax"]} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.75}
          fill={`url(#${id})`}
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
