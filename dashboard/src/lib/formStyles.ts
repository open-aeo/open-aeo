export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: "var(--text-sm)",
  fontFamily: "var(--font-sans)",
  color: "var(--color-text-primary)",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
};

export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-xs)",
  color: "var(--color-text-secondary)",
  marginBottom: "var(--space-1)",
};

export const fieldStyle: React.CSSProperties = { marginBottom: "var(--space-4)" };

export const ENGINE_LABELS: Record<string, string> = {
  perplexity: "Perplexity",
  chatgpt: "ChatGPT",
};

export function engineLabel(engine: string): string {
  return ENGINE_LABELS[engine] ?? engine;
}
