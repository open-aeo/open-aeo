import type { RunnableEngine } from "../lib/api";
import { labelStyle } from "../lib/formStyles";

const ENGINE_OPTIONS: { value: RunnableEngine; label: string }[] = [
  { value: "perplexity", label: "Perplexity" },
  { value: "chatgpt", label: "ChatGPT (web search)" },
];

export function EngineCheckboxes({
  selected,
  onToggle,
}: {
  selected: RunnableEngine[];
  onToggle: (value: RunnableEngine) => void;
}) {
  return (
    <div>
      <span style={labelStyle}>Engines</span>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {ENGINE_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              fontSize: "var(--text-sm)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => onToggle(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}
