import { NavLink, Route, Routes, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { useRunStream } from "@/lib/sse";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { RatingChip } from "@/components/RatingChip";
import { AgentStatusBoard } from "@/components/AgentStatusBoard";
import { MarkdownView } from "@/components/MarkdownView";
import { PMDecisionCard } from "@/components/PMDecisionCard";
import { InvestmentDebateTranscript, RiskDebatePanel } from "@/components/DebateTranscript";
import type { AgentStateSnapshot, Phase } from "@/types";

export default function RunViewerPage() {
  const { id } = useParams();
  const detailQ = useQuery({
    queryKey: ["run", id],
    queryFn: () => api.getRun(id!),
    refetchInterval: 2000,
    enabled: !!id,
  });

  const stream = useRunStream(id);

  // Fall back to persisted state when stream hasn't fired
  const liveState = useMemo<AgentStateSnapshot>(() => {
    return Object.keys(stream.state).length > 0
      ? stream.state
      : (detailQ.data?.final_state ?? {});
  }, [stream.state, detailQ.data]);

  const phase: Phase = stream.phase;
  const detail = detailQ.data;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="ticker text-accent-amber">
              {detail?.ticker ?? "…"}
            </span>
            {detail?.rating && <RatingChip rating={detail.rating as never} size="md" />}
          </span>
        }
        subtitle={
          <span className="ticker text-xs">
            {detail?.trade_date} · run {id?.slice(0, 8)} ·{" "}
            <span
              className={cn(
                "uppercase",
                detail?.status === "running" && "text-accent-amber",
                detail?.status === "completed" && "text-accent-green",
                detail?.status === "failed" && "text-rating-sell",
              )}
            >
              {detail?.status ?? "loading"}
            </span>
          </span>
        }
        right={
          detail?.stats && (
            <div className="flex gap-4 text-xs text-text-muted ticker">
              <span>LLM <span className="text-text">{detail.stats.llm_calls}</span></span>
              <span>TOOL <span className="text-text">{detail.stats.tool_calls}</span></span>
              <span>↑ <span className="text-text">{detail.stats.tokens_in}</span></span>
              <span>↓ <span className="text-text">{detail.stats.tokens_out}</span></span>
            </div>
          )
        }
      />

      <Tabs id={id!} />

      <div className="mt-6">
        <Routes>
          <Route index element={<Overview state={liveState} phase={phase} />} />
          <Route path="overview" element={<Overview state={liveState} phase={phase} />} />
          <Route path="analysts" element={<AnalystsTab state={liveState} />} />
          <Route path="debate" element={
            <div className="space-y-6">
              <section>
                <SectionTitle>Bull vs Bear</SectionTitle>
                <InvestmentDebateTranscript
                  bullHistory={liveState.investment_debate_state?.bull_history}
                  bearHistory={liveState.investment_debate_state?.bear_history}
                />
              </section>
              <section>
                <SectionTitle>Risk Debate</SectionTitle>
                <RiskDebatePanel
                  aggressive={liveState.risk_debate_state?.aggressive_history}
                  conservative={liveState.risk_debate_state?.conservative_history}
                  neutral={liveState.risk_debate_state?.neutral_history}
                />
              </section>
            </div>
          } />
          <Route path="decision" element={<PMDecisionCard decision={liveState.final_trade_decision} />} />
          <Route path="raw" element={<RawTab state={liveState} />} />
        </Routes>
      </div>
    </>
  );
}

function Tabs({ id }: { id: string }) {
  const tabs = [
    { to: `/runs/${id}/overview`,  label: "Overview" },
    { to: `/runs/${id}/analysts`,  label: "Analysts" },
    { to: `/runs/${id}/debate`,    label: "Debates" },
    { to: `/runs/${id}/decision`,  label: "Decision" },
    { to: `/runs/${id}/raw`,       label: "Raw State" },
  ];
  return (
    <div className="flex border-b border-border gap-1">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.label === "Overview"}
          className={({ isActive }) =>
            cn(
              "px-4 py-2 text-sm uppercase tracking-wider border-b-2 -mb-px transition-colors",
              isActive
                ? "border-accent-amber text-accent-amber"
                : "border-transparent text-text-muted hover:text-text"
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-widest text-text-subtle mb-3">
      {children}
    </div>
  );
}

function Overview({ state, phase }: { state: AgentStateSnapshot; phase: Phase }) {
  const currentMd =
    state.final_trade_decision ||
    state.trader_investment_plan ||
    state.investment_plan ||
    state.fundamentals_report ||
    state.news_report ||
    state.sentiment_report ||
    state.market_report ||
    "";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      <AgentStatusBoard state={state} phase={phase} />
      <div className="space-y-4">
        {state.final_trade_decision && (
          <PMDecisionCard decision={state.final_trade_decision} />
        )}
        <div className="terminal-card p-5">
          <div className="text-[10px] uppercase tracking-widest text-text-subtle mb-3">
            Most recent output
          </div>
          <MarkdownView md={currentMd} />
        </div>
      </div>
    </div>
  );
}

function AnalystsTab({ state }: { state: AgentStateSnapshot }) {
  const sections = [
    { key: "market_report",        label: "Market" },
    { key: "sentiment_report",     label: "Sentiment" },
    { key: "news_report",          label: "News" },
    { key: "fundamentals_report",  label: "Fundamentals" },
  ] as const;
  const [active, setActive] = useState<string>("market_report");
  // Fall back to first available
  useEffect(() => {
    if (!(state as never)[active]) {
      const first = sections.find((s) => (state as never)[s.key]);
      if (first) setActive(first.key);
    }
  }, [state]); // eslint-disable-line

  const content = (state as never)[active] as string | undefined;
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
      <div className="terminal-card divide-y divide-border">
        {sections.map((s) => {
          const has = !!(state as never)[s.key];
          return (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={cn(
                "w-full text-left px-4 py-2 text-sm flex items-center justify-between",
                active === s.key ? "bg-bg-overlay text-accent-amber" : "text-text-muted hover:text-text",
              )}
            >
              <span>{s.label}</span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  has ? "bg-accent-green" : "bg-border-strong",
                )}
              />
            </button>
          );
        })}
      </div>
      <div className="terminal-card p-5 min-h-[40vh]">
        <MarkdownView md={content} />
      </div>
    </div>
  );
}

function RawTab({ state }: { state: AgentStateSnapshot }) {
  const json = JSON.stringify(state, null, 2);
  const [copied, setCopied] = useState(false);
  return (
    <div className="terminal-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="text-[10px] uppercase tracking-widest text-text-subtle">
          Full AgentState
        </div>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(json);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-xs px-2 py-1 border border-border rounded-sm hover:border-accent-amber hover:text-accent-amber"
        >
          {copied ? "Copied!" : "Copy JSON"}
        </button>
      </div>
      <pre className="ticker text-xs p-4 overflow-x-auto text-text-muted">
        {json}
      </pre>
    </div>
  );
}
