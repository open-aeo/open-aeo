import { useMemo, useState } from "react";
import type { TrendPoint } from "../lib/api";

// Single-series citation-rate-over-time line. One series -> no legend needed
// (the title names it); thin 2px line, rounded ends, a hover crosshair +
// tooltip since this chart is interactive by default (dataviz skill).
export function TrendLine({ points }: { points: TrendPoint[] }) {
  const width = 640;
  const height = 120;
  const padding = 12;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { path, coords } = useMemo(() => {
    if (points.length === 0) return { path: "", coords: [] as { x: number; y: number }[] };
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;
    const step = points.length > 1 ? innerWidth / (points.length - 1) : 0;

    const pts = points.map((p, i) => ({
      x: padding + i * step,
      y: padding + (1 - p.citationRate) * innerHeight,
    }));

    const d = pts
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");

    return { path: d, coords: pts };
  }, [points]);

  if (points.length === 0) {
    return (
      <div
        style={{
          color: "var(--color-text-tertiary)",
          fontSize: "var(--text-sm)",
          padding: "var(--space-6) 0",
          textAlign: "center",
        }}
      >
        No checks yet.
      </div>
    );
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const hoveredCoord = hoverIndex !== null ? coords[hoverIndex] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relativeX = ((e.clientX - rect.left) / rect.width) * width;
          let closest = 0;
          let closestDist = Infinity;
          coords.forEach((c, i) => {
            const dist = Math.abs(c.x - relativeX);
            if (dist < closestDist) {
              closestDist = dist;
              closest = i;
            }
          });
          setHoverIndex(closest);
        }}
      >
        {/* Baseline */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="var(--color-border)"
          strokeWidth={1}
        />
        <path
          d={path}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {hoveredCoord && (
          <>
            <line
              x1={hoveredCoord.x}
              y1={padding}
              x2={hoveredCoord.x}
              y2={height - padding}
              stroke="var(--color-border-strong)"
              strokeWidth={1}
            />
            <circle
              cx={hoveredCoord.x}
              cy={hoveredCoord.y}
              r={4}
              fill="var(--color-accent)"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          </>
        )}
      </svg>
      {hovered && hoveredCoord && (
        <div
          style={{
            position: "absolute",
            left: `${(hoveredCoord.x / width) * 100}%`,
            top: 0,
            transform: "translate(-50%, -100%)",
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            padding: "4px 8px",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-primary)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {hovered.date} — {Math.round(hovered.citationRate * 100)}% (
          {hovered.checksCount} check{hovered.checksCount === 1 ? "" : "s"})
        </div>
      )}
    </div>
  );
}
