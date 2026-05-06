import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { RatingChip } from "@/components/RatingChip";
import { formatPct, pctColor } from "@/lib/utils";

export default function MemoryListPage() {
  const q = useQuery({ queryKey: ["memory"], queryFn: api.listMemory });
  const [search, setSearch] = useState("");

  const entries = (q.data ?? []).filter((e) =>
    `${e.ticker} ${e.rating} ${e.date}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Memory"
        subtitle={`${q.data?.length ?? 0} decisions logged`}
        right={
          <input
            placeholder="Filter…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ticker bg-bg-overlay border border-border rounded-sm
                       px-3 py-1.5 text-text outline-none focus:border-accent-amber text-sm"
          />
        }
      />

      <div className="terminal-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-text-subtle">
              <th className="text-left px-4 py-2">Ticker</th>
              <th className="text-left px-4 py-2">Date</th>
              <th className="text-left px-4 py-2">Rating</th>
              <th className="text-right px-4 py-2">Raw</th>
              <th className="text-right px-4 py-2">α vs SPY</th>
              <th className="text-right px-4 py-2">Holding</th>
              <th className="text-left px-4 py-2">Reflection</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-subtle">
                  No matching entries.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={`${e.ticker}-${e.date}`} className="hover:bg-bg-overlay">
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
                  {e.holding ?? (e.pending ? "pending" : "—")}
                </td>
                <td className="px-4 py-2 text-xs text-text-muted max-w-md truncate">
                  {e.reflection || (e.pending ? <em className="text-text-subtle">pending outcome</em> : "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
