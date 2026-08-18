export function StatTile({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | number;
  loading: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
        padding: "var(--space-4) var(--space-6)",
      }}
    >
      {loading ? (
        <div
          style={{
            width: "48px",
            height: "28px",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface-raised)",
          }}
        />
      ) : (
        <span
          style={{
            fontSize: "var(--text-2xl)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
      )}
      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
        {label}
      </span>
    </div>
  );
}
