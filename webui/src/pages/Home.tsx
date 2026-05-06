import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, PlusCircle, Server } from "lucide-react";

import { api } from "@/lib/api";
import { pctColor, formatPct, relTime } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { RatingChip } from "@/components/RatingChip";
import { StatPill } from "@/components/StatPill";

export default function HomePage() {
  const memQ = useQuery({ queryKey: ["memory"], queryFn: api.listMemory });
  const runsQ = useQuery({ queryKey: ["runs"], queryFn: api.listRuns });
  const healthQ = useQuery({ queryKey: ["health"], queryFn: api.health });

  const entries = memQ.data ?? [];
  const runs = runsQ.data ?? [];
  const liveRun = runs.find((r) => r.status === "running" || r.status === "queued");

  // Stats
  const total = entries.length;
  const resolved = entries.filter((e) => !e.pending);
  const avgAlpha =
    resolved.length > 0
      ? resolved.reduce((acc, e) => acc + parseFloat((e.alpha_return ?? "0").replace("%", "").replace("+", "")), 0) /
        resolved.length
      : null;

  // Latest decision per ticker
  const byTicker = new Map<string, typeof entries[number]>();
  for (const e of entries) {
    if (!byTicker.has(e.ticker)) byTicker.set(e.ticker, e);
  }
  const watchlist = Array.from(byTicker.values()).slice(0, 8);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={
          <span className="ticker">
            {healthQ.data ? `connected · v${healthQ.data.version}` : "connecting…"}
          </span>
        }
        right={
          <Link
            to="/runs/new"
            className="ticker uppercase text-xs px-3 py-2 bg-accent-amber text-bg
                       rounded-sm hover:bg-amber-300 flex items-center gap-2"
          >
            <PlusCircle size={14} />
            New Run
          </Link>
        }
      />

      {/* Live banner */}
      {liveRun && (
        <Link
          to={`/runs/${liveRun.run_id}/overview`}
          className="terminal-card p-4 mb-6 flex items-center justify-between
                     border-accent-amber/40 hover:border-accent-amber transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-accent-amber animate-pulse-amber" />
            <span className="ticker text-accent-amber">{liveRun.ticker}</span>
            <span className="text-text-muted text-sm">running · {liveRun.trade_date}</span>
          </div>
          <ArrowRight size={16} className="text-accent-amber" />
        </Link>
      )}

      {/* Stat pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatPill label="Decisions Logged" value={total} hint="total entries" />
        <StatPill
          label="Resolved"
          value={resolved.length}
          hint={`${total - resolved.length} pending`}
          tone="cyan"
        />
        <StatPill
          label="Avg α vs SPY"
          value={avgAlpha !== null ? `${avgAlpha >= 0 ? "+" : ""}${avgAlpha.toFixed(1)}%` : "—"}
          tone={avgAlpha !== null && avgAlpha >= 0 ? "green" : "red"}
        />
        <StatPill
          label="Active Runs"
          value={runs.filter((r) => r.status === "running" || r.status === "queued").length}
          hint="in flight"
          tone="amber"
        />
      </div>

      {/* Watchlist */}
      <section className="terminal-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-text-muted text-xs uppercase tracking-widest">
            <Server size={12} />
            Latest Decisions
          </div>
          <Link
            to="/memory"
            className="text-xs text-accent-cyan hover:underline"
          >
            View all →
          </Link>
        </div>
        {watchlist.length === 0 ? (
          <div className="p-8 text-center text-text-subtle">
            No decisions logged yet. Click <span className="text-accent-amber">New Run</span> to start.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-text-subtle">
                <th className="text-left px-4 py-2">Ticker</th>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Rating</th>
                <th className="text-right px-4 py-2">Raw</th>
                <th className="text-right px-4 py-2">α vs SPY</th>
                <th className="text-right px-4 py-2">Holding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {watchlist.map((e) => (
                <tr
                  key={`${e.ticker}-${e.date}`}
                  className="hover:bg-bg-overlay transition-colors"
                >
                  <td className="px-4 py-2">
                    <Link
                      to={`/memory/${e.ticker}`}
                      className="ticker text-accent-amber hover:underline"
                    >
                      {e.ticker}
                    </Link>
                  </td>
                  <td className="px-4 py-2 ticker text-text-muted text-sm">{e.date}</td>
                  <td className="px-4 py-2">
                    <RatingChip rating={e.rating as never} size="sm" />
                  </td>
                  <td className={`px-4 py-2 ticker text-right numeric ${pctColor(e.raw_return)}`}>
                    {formatPct(e.raw_return)}
                  </td>
                  <td className={`px-4 py-2 ticker text-right numeric ${pctColor(e.alpha_return)}`}>
                    {formatPct(e.alpha_return)}
                  </td>
                  <td className="px-4 py-2 ticker text-right text-text-muted text-sm">
                    {e.holding ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
