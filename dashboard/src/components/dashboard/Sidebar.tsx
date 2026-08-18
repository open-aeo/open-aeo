import {
  BarChart3,
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  MessageSquareText,
  PlayCircle,
  Settings2,
  Swords,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type Section = "overview" | "prompts" | "competitors" | "run" | "settings";

const NAV_GROUPS: { label: string; items: { id: Section; label: string; icon: LucideIcon }[] }[] = [
  {
    label: "Monitor",
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "prompts", label: "Prompts", icon: MessageSquareText },
      { id: "competitors", label: "Competitors", icon: Swords },
    ],
  },
  {
    label: "Workspace",
    items: [
      { id: "run", label: "Run a check", icon: PlayCircle },
      { id: "settings", label: "Settings", icon: Settings2 },
    ],
  },
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
    <aside className="bg-sidebar border-sidebar-border sticky top-0 flex h-svh w-[228px] shrink-0 flex-col border-r">
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
          <BarChart3 className="size-4" />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-semibold tracking-tight">open-aeo</div>
          <div className="text-muted-foreground truncate text-[11px]">Answer engine monitor</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-3">
            <div className="text-muted-foreground px-2 pt-2 pb-1.5 text-[11px] font-medium tracking-wide uppercase">
              {group.label}
            </div>
            {group.items.map((item) => {
              const isActive = item.id === active;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <item.icon className={cn("size-4", isActive && "text-primary")} />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-sidebar-border border-t p-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="hover:bg-sidebar-accent flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors outline-none">
            <span className="bg-primary/12 text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase">
              {(login ?? "?").slice(0, 2)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">{login ?? "Signed in"}</span>
            <ChevronsUpDown className="text-muted-foreground size-3.5 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-[204px]">
            <DropdownMenuLabel>{login ?? "Account"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onSelect("settings")}>
              <Settings2 />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
