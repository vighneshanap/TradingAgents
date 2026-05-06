import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { RatingChip } from "@/components/RatingChip";
import { MarkdownView } from "@/components/MarkdownView";
import { formatPct, pctColor } from "@/lib/utils";

function pct(s?: string | null): number | null {
  if (!s) return null;
  const cleaned = s.replace("%", "").replace("+", "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export default function MemoryTickerPage() {
  const { ticker } = useParams();
  const q = useQuery({
    queryKey: ["memory", ticker],
    queryFn: () => api.memoryFor(ticker!),
    enabled: !!ticker,
  });

  const entries = (q.data ?? []).slice().reverse(); // oldest → newest for chart
  const chartData = entries
    .filter((e) => !e.pending && e.alpha_return)
    .map((e) => ({ date: e.date, alpha: pct(e.alpha_return) ?? 0, raw: pct(e.raw_return) ?? 0 }));

  return (
    <>
      <PageHeader
        title={
          <span className="ticker text-accent-amber">{ticker}</span>
        }
        subtitle={`${q.data?.length ?? 0} decisions on this ticker`}
      />

      {/* Chart */}
      <div className="terminal-card p-4 mb-6">
        <div className="text-[10px] uppercase tracking-widest text-text-subtle mb-3">
          α vs SPY (resolved)
        </div>
        <div className="h-64">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-text-subtle italic">
              No resolved decisions yet — needs at least one same-ticker run with realised return.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="alpha" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFB000" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#FFB000" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1F2742" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#5C6889" tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }} />
                <YAxis stroke="#5C6889" tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F1424",
                    border: "1px solid #1F2742",
                    fontFamily: "JetBrains Mono",
                    fontSize: 12,
                  }}
                  itemStyle={{ color: "#E8ECF7" }}
                />
                <Area
                  type="monotone"
                  dataKey="alpha"
                  stroke="#FFB000"
                  strokeWidth={2}
                  fill="url(#alpha)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Decisions */}
      <div className="space-y-4">
        {entries.slice().reverse().map((e) => (
          <div key={e.date} className="terminal-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="ticker text-text-muted">{e.date}</span>
                <RatingChip rating={e.rating as never} size="sm" />
                {e.pending && (
                  <span className="text-[10px] uppercase tracking-widest text-accent-amber">
                    pending α
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className={`ticker numeric ${pctColor(e.raw_return)}`}>
                  raw {formatPct(e.raw_return)}
                </span>
                <span className={`ticker numeric ${pctColor(e.alpha_return)}`}>
                  α {formatPct(e.alpha_return)}
                </span>
                <span className="ticker text-text-subtle">{e.holding ?? "—"}</span>
              </div>
            </div>
            {e.reflection && (
              <div className="border-l-2 border-accent-amber/40 pl-3 mb-4">
                <div className="text-[10px] uppercase tracking-widest text-text-subtle mb-1">
                  Reflection
                </div>
                <p className="text-sm text-text leading-relaxed">{e.reflection}</p>
              </div>
            )}
            <details>
              <summary className="cursor-pointer text-xs text-text-subtle hover:text-text">
                View decision markdown
              </summary>
              <div className="mt-3 border-t border-border pt-3">
                <MarkdownView md={e.decision} />
              </div>
            </details>
          </div>
        ))}
      </div>
    </>
  );
}
