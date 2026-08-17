export type Section = "overview" | "prompts" | "competitors" | "run" | "settings";

const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "prompts", label: "Prompts" },
  { id: "competitors", label: "Competitors" },
  { id: "run", label: "Run" },
  { id: "settings", label: "Settings" },
];

export function Sidebar({
  active,
  onSelect,
  login,
  onLogout,
}: {
  active: Section;
  onSelect: (section: Section) => void;
  login: string | null;
  onLogout: () => void;
}) {
  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        borderRight: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      <div
        style={{
          padding: "var(--space-4) var(--space-6)",
          fontWeight: 700,
          fontSize: "var(--text-lg)",
          letterSpacing: "-0.02em",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        open-aeo
      </div>

      <nav style={{ flex: 1, padding: "var(--space-3)" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                padding: "8px 12px",
                marginBottom: "2px",
                borderRadius: "var(--radius-md)",
                border: "none",
                background: isActive ? "var(--color-surface-raised)" : "transparent",
                color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                fontSize: "var(--text-sm)",
                fontFamily: "var(--font-sans)",
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: "var(--space-4)", borderTop: "1px solid var(--color-border)" }}>
        {login && (
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-secondary)",
              marginBottom: "var(--space-2)",
            }}
          >
            {login}
          </div>
        )}
        <button
          onClick={onLogout}
          style={{
            width: "100%",
            background: "none",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "6px 12px",
            fontSize: "var(--text-xs)",
            color: "var(--color-text-secondary)",
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
          }}
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
