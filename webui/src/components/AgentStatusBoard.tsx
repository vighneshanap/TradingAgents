import { Check, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentStateSnapshot, Phase } from "@/types";

type Status = "pending" | "in_progress" | "completed";

const TEAMS: { name: string; agents: string[] }[] = [
  { name: "Analyst Team",       agents: ["Market Analyst", "Social Analyst", "News Analyst", "Fundamentals Analyst"] },
  { name: "Research Team",      agents: ["Bull Researcher", "Bear Researcher", "Research Manager"] },
  { name: "Trading Team",       agents: ["Trader"] },
  { name: "Risk Management",    agents: ["Aggressive Analyst", "Conservative Analyst", "Neutral Analyst"] },
  { name: "Portfolio Management", agents: ["Portfolio Manager"] },
];

function deriveStatuses(state: AgentStateSnapshot, phase: Phase): Record<string, Status> {
  const s: Record<string, Status> = {};
  for (const t of TEAMS) for (const a of t.agents) s[a] = "pending";

  if (state.market_report)        s["Market Analyst"]      = "completed";
  if (state.sentiment_report)     s["Social Analyst"]      = "completed";
  if (state.news_report)          s["News Analyst"]        = "completed";
  if (state.fundamentals_report)  s["Fundamentals Analyst"] = "completed";

  const idb = state.investment_debate_state;
  if (idb?.bull_history)        s["Bull Researcher"] = "completed";
  if (idb?.bear_history)        s["Bear Researcher"] = "completed";
  if (state.investment_plan)    s["Research Manager"] = "completed";
  if (state.trader_investment_plan) s["Trader"] = "completed";

  const rdb = state.risk_debate_state;
  if (rdb?.aggressive_history)   s["Aggressive Analyst"] = "completed";
  if (rdb?.conservative_history) s["Conservative Analyst"] = "completed";
  if (rdb?.neutral_history)      s["Neutral Analyst"] = "completed";
  if (state.final_trade_decision) s["Portfolio Manager"] = "completed";

  // Mark the agent matching current phase as in_progress (if not already done)
  const phaseToAgent: Partial<Record<Phase, string>> = {
    market_analyst: "Market Analyst",
    social_analyst: "Social Analyst",
    news_analyst: "News Analyst",
    fundamentals_analyst: "Fundamentals Analyst",
    research_debate: "Bull Researcher",
    research_manager: "Research Manager",
    trader: "Trader",
    risk_debate: "Aggressive Analyst",
    pm_decided: "Portfolio Manager",
  };
  const active = phase && phaseToAgent[phase];
  if (active && s[active] !== "completed") s[active] = "in_progress";

  return s;
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "completed")
    return <Check size={14} className="text-accent-green" />;
  if (status === "in_progress")
    return <Loader2 size={14} className="text-accent-amber animate-spin" />;
  return <Clock size={14} className="text-text-subtle" />;
}

export function AgentStatusBoard({
  state,
  phase,
}: {
  state: AgentStateSnapshot;
  phase: Phase;
}) {
  const statuses = deriveStatuses(state, phase);
  return (
    <div className="terminal-card divide-y divide-border">
      {TEAMS.map((team) => (
        <div key={team.name} className="px-4 py-3">
          <div className="text-[10px] uppercase tracking-widest text-text-subtle mb-2">
            {team.name}
          </div>
          <ul className="grid grid-cols-1 gap-1.5">
            {team.agents.map((a) => {
              const st = statuses[a];
              return (
                <li
                  key={a}
                  className={cn(
                    "flex items-center justify-between px-2 py-1.5 rounded-sm text-sm",
                    st === "in_progress" && "bg-accent-amber/5 ring-1 ring-accent-amber/30",
                    st === "completed" && "text-text-muted",
                  )}
                >
                  <span>{a}</span>
                  <span className="flex items-center gap-2">
                    <StatusIcon status={st} />
                    <span className="text-[10px] uppercase tracking-wider text-text-subtle">
                      {st.replace("_", " ")}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
