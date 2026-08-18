import type { RunnableEngine } from "@/lib/api";
import { engineMeta, RUNNABLE_ENGINES } from "@/lib/engines";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/*
 * Engine selection as toggle chips rather than a checkbox column: with two
 * options carrying brand marks, the chips read faster and take one row.
 */
export function EnginePicker({
  selected,
  onToggle,
  label = "Engines",
  className,
}: {
  selected: RunnableEngine[];
  onToggle: (engine: RunnableEngine) => void;
  label?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label>{label}</Label>}
      <div className="flex flex-wrap gap-1.5">
        {RUNNABLE_ENGINES.map((engine) => {
          const { label: name, Icon } = engineMeta(engine);
          const isOn = selected.includes(engine);
          return (
            <button
              key={engine}
              type="button"
              aria-pressed={isOn}
              onClick={() => onToggle(engine)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
                isOn
                  ? "border-primary/40 bg-primary/8 text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className={cn("size-3.5", !isOn && "opacity-60 grayscale")} />
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
