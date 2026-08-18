import { engineMeta } from "@/lib/engines";
import { cn } from "@/lib/utils";

/** An engine's brand mark plus its name — the standard way to name an engine. */
export function EngineTag({
  engine,
  className,
  showLabel = true,
  iconClassName,
}: {
  engine: string;
  className?: string;
  showLabel?: boolean;
  iconClassName?: string;
}) {
  const { label, Icon } = engineMeta(engine);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={label}>
      <Icon className={cn("size-3.5", iconClassName)} />
      {showLabel && <span>{label}</span>}
    </span>
  );
}

/** Icon-only stack for listing several engines in a tight cell. */
export function EngineStack({ engines }: { engines: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {engines.map((engine) => (
        <EngineTag key={engine} engine={engine} showLabel={false} />
      ))}
    </span>
  );
}
