import { NavLink, useLocation } from "react-router-dom";
import {
  Activity, BarChart3, ListChecks, PlusCircle, Settings, Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/",         label: "Dashboard", icon: Activity },
  { to: "/runs/new", label: "New Run",   icon: PlusCircle },
  { to: "/runs",     label: "Runs",      icon: ListChecks },
  { to: "/memory",   label: "Memory",    icon: BarChart3 },
  { to: "/settings", label: "Settings",  icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <div className="grid h-screen grid-cols-[220px_1fr] grid-rows-[56px_1fr]">
      {/* Top bar */}
      <header
        className="col-span-2 relative flex items-center justify-between
                   border-b border-border bg-bg-elevated px-6 scanline"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center
                          bg-accent-amber text-bg rounded-sm shadow-sm">
            <Terminal size={16} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="ticker text-sm text-text">
              TRADINGAGENTS
            </span>
            <span className="text-[10px] uppercase tracking-widest text-text-subtle">
              Multi-Agent · LLM · Terminal
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="ticker">{loc.pathname}</span>
          <span className="h-2 w-2 rounded-full bg-accent-green animate-pulse" />
          <span>LIVE</span>
        </div>
      </header>

      {/* Sidebar */}
      <aside className="border-r border-border bg-bg-elevated p-2 flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors",
                isActive
                  ? "bg-bg-overlay text-accent-amber border-l-2 border-accent-amber"
                  : "text-text-muted hover:bg-bg-overlay hover:text-text"
              )
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
        <div className="mt-auto px-3 py-3 text-[10px] text-text-subtle">
          <div className="ticker">v0.2.4</div>
          <div>Bloomberg dark</div>
        </div>
      </aside>

      {/* Main */}
      <main className="overflow-auto bg-bg">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
