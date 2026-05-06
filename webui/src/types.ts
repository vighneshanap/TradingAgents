/** Mirrors webserver/models.py — keep in sync. */

export type Provider =
  | "openai" | "anthropic" | "google" | "azure" | "xai"
  | "deepseek" | "qwen" | "glm" | "openrouter" | "ollama";

export type AnalystKey = "market" | "social" | "news" | "fundamentals";
export type VendorKey = "yfinance" | "alpha_vantage";
export type Rating = "Buy" | "Overweight" | "Hold" | "Underweight" | "Sell";
export type RunStatus =
  | "queued" | "running" | "completed" | "failed" | "cancelled";

export interface RunRequest {
  ticker: string;
  trade_date: string; // YYYY-MM-DD
  selected_analysts: AnalystKey[];
  research_depth: 1 | 3 | 5;
  llm_provider: Provider;
  deep_think_llm: string;
  quick_think_llm: string;
  output_language: string;
  google_thinking_level?: "low" | "minimal" | "medium" | "high" | null;
  openai_reasoning_effort?: "low" | "medium" | "high" | null;
  anthropic_effort?: "low" | "medium" | "high" | null;
  checkpoint_enabled: boolean;
  data_vendors: Record<
    "core_stock_apis" | "technical_indicators" | "fundamental_data" | "news_data",
    VendorKey
  >;
}

export interface RunSummary {
  run_id: string;
  ticker: string;
  trade_date: string;
  status: RunStatus;
  rating?: Rating | null;
  started_at?: string | null;
  finished_at?: string | null;
  error?: string | null;
}

export interface InvestDebateState {
  bull_history: string;
  bear_history: string;
  history: string;
  judge_decision: string;
  count: number;
}

export interface RiskDebateState {
  aggressive_history: string;
  conservative_history: string;
  neutral_history: string;
  history: string;
  latest_speaker: string;
  judge_decision: string;
  count: number;
}

export interface AgentStateSnapshot {
  company_of_interest?: string;
  trade_date?: string;
  market_report?: string;
  sentiment_report?: string;
  news_report?: string;
  fundamentals_report?: string;
  investment_plan?: string;
  trader_investment_plan?: string;
  final_trade_decision?: string;
  investment_debate_state?: InvestDebateState;
  risk_debate_state?: RiskDebateState;
  past_context?: string;
}

export interface RunDetail extends RunSummary {
  request?: RunRequest;
  final_state?: AgentStateSnapshot;
  stats?: { llm_calls: number; tool_calls: number; tokens_in: number; tokens_out: number };
}

export interface MemoryEntry {
  date: string;
  ticker: string;
  rating: string;
  pending: boolean;
  raw_return?: string | null;
  alpha_return?: string | null;
  holding?: string | null;
  decision: string;
  reflection: string;
}

export interface ProviderInfo {
  name: Provider;
  label: string;
  api_key_env: string | null;
  api_key_configured: boolean;
  models_quick: { label: string; value: string }[];
  models_deep: { label: string; value: string }[];
}

export interface HealthResponse {
  status: "ok";
  version: string;
}

export type Phase =
  | "starting"
  | "market_analyst" | "social_analyst" | "news_analyst" | "fundamentals_analyst"
  | "research_debate" | "research_manager" | "trader"
  | "risk_debate" | "pm_decided"
  | "running" | "done";

export interface SSEChunk {
  phase: Phase;
  data: AgentStateSnapshot;
}
