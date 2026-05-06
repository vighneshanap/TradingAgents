import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Check, X, AlertTriangle, Clock } from "lucide-react";

import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { RatingChip } from "@/components/RatingChip";
import { relTime } from "@/lib/utils";
import type { RunStatus } from "@/types";

const STATUS_ICONS: Record<RunStatus, JSX.Element> = {
  queued:    <Clock size={14} className="text-text-subtle" />,
  running:   <Loader2 size={14} className="text-accent-amber animate-spin" />,
  completed: <Check size={14} className="text-accent-green" />,
  failed:    <AlertTriangle size={14} className="text-rating-sell" />,
  cancelled: <X size={14} className="text-text-muted" />,
};

export default function RunsListPage() {
  const q = useQuery({
    queryKey: ["runs"],
    queryFn: api.listRuns,
    refetchInterval: 2000,
  });

  return (
    <>
      <PageHeader title="Runs" subtitle="In-memory + persisted runs" />
      <div className="terminal-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-text-subtle">
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Ticker</th>
              <th className="text-left px-4 py-2">Date</th>
              <th className="text-left px-4 py-2">Rating</th>
              <th className="text-left px-4 py-2">Started</th>
              <th className="text-left px-4 py-2">Run ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(q.data ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-subtle">
                  No runs yet.
                </td>
              </tr>
            )}
            {(q.data ?? []).map((r) => (
              <tr key={r.run_id} className="hover:bg-bg-overlay">
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2 text-xs uppercase tracking-wider">
                    {STATUS_ICONS[r.status]}
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <Link
                    to={`/runs/${r.run_id}/overview`}
                    className="ticker text-accent-amber hover:underline"
                  >
                    {r.ticker}
                  </Link>
                </td>
                <td className="px-4 py-2 ticker text-sm text-text-muted">{r.trade_date}</td>
                <td className="px-4 py-2">
                  {r.rating ? <RatingChip rating={r.rating as never} size="sm" /> : "—"}
                </td>
                <td className="px-4 py-2 text-sm text-text-muted">
                  {relTime(r.started_at)}
                </td>
                <td className="px-4 py-2 ticker text-[11px] text-text-subtle">
                  {r.run_id}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
