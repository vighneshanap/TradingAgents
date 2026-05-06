import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Play, AlertTriangle } from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import type { AnalystKey, Provider, RunRequest } from "@/types";

const ANALYSTS: { key: AnalystKey; label: string }[] = [
  { key: "market", label: "Market" },
  { key: "social", label: "Social" },
  { key: "news", label: "News" },
  { key: "fundamentals", label: "Fundamentals" },
];

const DEPTHS = [
  { value: 1, label: "Shallow", desc: "1 round · fastest" },
  { value: 3, label: "Medium",  desc: "3 rounds · balanced" },
  { value: 5, label: "Deep",    desc: "5 rounds · most thorough" },
] as const;

export default function NewRunPage() {
  const navigate = useNavigate();
  const provQ = useQuery({ queryKey: ["providers"], queryFn: api.providers });

  const [ticker, setTicker] = useState("NVDA");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [analysts, setAnalysts] = useState<AnalystKey[]>([
    "market", "social", "news", "fundamentals",
  ]);
  const [depth, setDepth] = useState<1 | 3 | 5>(1);
  const [provider, setProvider] = useState<Provider>("openai");
  const [quickModel, setQuickModel] = useState<string>("");
  const [deepModel, setDeepModel] = useState<string>("");
  const [language, setLanguage] = useState("English");
  const [checkpoint, setCheckpoint] = useState(true);

  // Sync default models when provider changes
  useEffect(() => {
    const p = provQ.data?.find((x) => x.name === provider);
    if (p) {
      if (!quickModel) setQuickModel(p.models_quick[0]?.value ?? "");
      if (!deepModel) setDeepModel(p.models_deep[0]?.value ?? "");
    }
  }, [provQ.data, provider]); // eslint-disable-line

  const providerInfo = provQ.data?.find((x) => x.name === provider);
  const keyOk = providerInfo?.api_key_configured ?? false;

  const createMut = useMutation({
    mutationFn: (req: RunRequest) => api.createRun(req),
    onSuccess: (run) => navigate(`/runs/${run.run_id}/overview`),
  });

  const submit = () => {
    const req: RunRequest = {
      ticker: ticker.trim().toUpperCase(),
      trade_date: date,
      selected_analysts: analysts,
      research_depth: depth,
      llm_provider: provider,
      deep_think_llm: deepModel,
      quick_think_llm: quickModel,
      output_language: language,
      checkpoint_enabled: checkpoint,
      data_vendors: {
        core_stock_apis: "yfinance",
        technical_indicators: "yfinance",
        fundamental_data: "yfinance",
        news_data: "yfinance",
      },
    };
    createMut.mutate(req);
  };

  return (
    <>
      <PageHeader
        title="New Run"
        subtitle="Configure a multi-agent analysis"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticker + Date */}
          <Section title="Instrument">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ticker">
                <input
                  className="ticker w-full bg-bg-overlay border border-border rounded-sm
                             px-3 py-2 text-text uppercase tracking-ticker outline-none
                             focus:border-accent-amber"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  placeholder="NVDA"
                />
              </Field>
              <Field label="Analysis Date">
                <input
                  type="date"
                  className="ticker w-full bg-bg-overlay border border-border rounded-sm
                             px-3 py-2 text-text outline-none focus:border-accent-amber"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
            </div>
          </Section>

          {/* Analysts */}
          <Section title="Analyst Team">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {ANALYSTS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() =>
                    setAnalysts((cur) =>
                      cur.includes(a.key)
                        ? cur.filter((x) => x !== a.key)
                        : [...cur, a.key]
                    )
                  }
                  className={cn(
                    "px-3 py-2 rounded-sm text-sm border transition-colors text-left",
                    analysts.includes(a.key)
                      ? "bg-accent-amber/10 border-accent-amber text-accent-amber"
                      : "bg-bg-overlay border-border text-text-muted hover:text-text"
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Research depth */}
          <Section title="Research Depth">
            <div className="grid grid-cols-3 gap-2">
              {DEPTHS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDepth(d.value)}
                  className={cn(
                    "px-4 py-3 rounded-sm border text-left transition-colors",
                    depth === d.value
                      ? "bg-accent-cyan/10 border-accent-cyan text-text"
                      : "bg-bg-overlay border-border text-text-muted hover:text-text"
                  )}
                >
                  <div className="ticker text-sm">{d.label}</div>
                  <div className="text-[11px] text-text-subtle mt-0.5">{d.desc}</div>
                </button>
              ))}
            </div>
          </Section>

          {/* LLM */}
          <Section title="LLM Provider">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
              {provQ.data?.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    setProvider(p.name);
                    setQuickModel(p.models_quick[0]?.value ?? "");
                    setDeepModel(p.models_deep[0]?.value ?? "");
                  }}
                  className={cn(
                    "px-2 py-2 rounded-sm text-xs border transition-colors flex items-center justify-between gap-1",
                    provider === p.name
                      ? "bg-accent-amber/10 border-accent-amber text-accent-amber"
                      : "bg-bg-overlay border-border text-text-muted hover:text-text"
                  )}
                >
                  <span>{p.label}</span>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      p.api_key_configured ? "bg-accent-green" : "bg-rating-sell"
                    )}
                    title={p.api_key_configured ? "Key configured" : "Key missing"}
                  />
                </button>
              ))}
            </div>

            {!keyOk && provider !== "ollama" && (
              <div className="flex items-start gap-2 px-3 py-2 mb-3 border
                              border-rating-sell/40 bg-rating-sell/5 rounded-sm text-xs text-rating-sell">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  No API key detected for{" "}
                  <span className="ticker">{providerInfo?.api_key_env}</span>. Set it in your
                  shell or .env before running, or pick another provider.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Quick-think model">
                <select
                  className="ticker w-full bg-bg-overlay border border-border rounded-sm
                             px-3 py-2 text-text outline-none focus:border-accent-amber"
                  value={quickModel}
                  onChange={(e) => setQuickModel(e.target.value)}
                >
                  {providerInfo?.models_quick.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Deep-think model">
                <select
                  className="ticker w-full bg-bg-overlay border border-border rounded-sm
                             px-3 py-2 text-text outline-none focus:border-accent-amber"
                  value={deepModel}
                  onChange={(e) => setDeepModel(e.target.value)}
                >
                  {providerInfo?.models_deep.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </Field>
            </div>
          </Section>

          <Section title="Other">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Output language">
                <input
                  className="w-full bg-bg-overlay border border-border rounded-sm
                             px-3 py-2 text-text outline-none focus:border-accent-amber"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                />
              </Field>
              <Field label="Checkpoint resume">
                <label className="flex items-center gap-2 px-3 py-2 bg-bg-overlay
                                   border border-border rounded-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkpoint}
                    onChange={(e) => setCheckpoint(e.target.checked)}
                    className="accent-accent-amber"
                  />
                  <span className="text-sm">Save state per node (resumable)</span>
                </label>
              </Field>
            </div>
          </Section>
        </div>

        {/* Right: Review + submit */}
        <aside className="terminal-card p-5 h-fit lg:sticky lg:top-6">
          <div className="text-[10px] uppercase tracking-widest text-text-subtle mb-3">
            Review
          </div>
          <dl className="space-y-2 text-sm">
            <Row k="Ticker" v={<span className="ticker text-accent-amber">{ticker.toUpperCase() || "—"}</span>} />
            <Row k="Date" v={<span className="ticker">{date}</span>} />
            <Row k="Analysts" v={analysts.length === 0 ? <span className="text-rating-sell">none!</span> : analysts.join(", ")} />
            <Row k="Depth" v={DEPTHS.find((d) => d.value === depth)!.label} />
            <Row k="Provider" v={providerInfo?.label ?? provider} />
            <Row k="Quick" v={<span className="ticker text-xs">{quickModel || "—"}</span>} />
            <Row k="Deep" v={<span className="ticker text-xs">{deepModel || "—"}</span>} />
          </dl>
          <button
            disabled={
              !ticker || analysts.length === 0 || !quickModel || !deepModel ||
              createMut.isPending
            }
            onClick={submit}
            className="mt-5 w-full ticker uppercase tracking-ticker
                       bg-accent-amber text-bg px-4 py-3 rounded-sm
                       hover:bg-amber-300 disabled:bg-border disabled:text-text-subtle
                       disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Play size={14} />
            {createMut.isPending ? "Starting…" : "Start Run"}
          </button>
          {createMut.isError && (
            <div className="mt-3 text-xs text-rating-sell">
              {String((createMut.error as Error).message)}
            </div>
          )}
          <div className="mt-4 text-[11px] text-text-subtle leading-relaxed">
            ⚠ This will trigger ~16 LLM calls and incur provider costs.
            Free α-vs-SPY α resolution happens automatically on the next same-ticker run.
          </div>
        </aside>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-text-subtle mb-2">
        {title}
      </div>
      <div className="terminal-card p-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-text-subtle mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-text-subtle text-xs uppercase tracking-wider">{k}</dt>
      <dd className="text-text">{v}</dd>
    </div>
  );
}
