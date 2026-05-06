import { cn } from "@/lib/utils";

interface Turn {
  speaker: string;
  text: string;
}

function splitTurns(history: string | undefined, prefix: string): Turn[] {
  if (!history) return [];
  return history
    .split(`${prefix}:`)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((t) => ({ speaker: prefix, text: t }));
}

export function InvestmentDebateTranscript({
  bullHistory,
  bearHistory,
}: {
  bullHistory?: string;
  bearHistory?: string;
}) {
  const bull = splitTurns(bullHistory, "Bull Analyst");
  const bear = splitTurns(bearHistory, "Bear Analyst");

  if (bull.length === 0 && bear.length === 0) {
    return (
      <div className="terminal-card p-6 text-text-subtle italic">
        Bull / Bear debate hasn't started yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <DebateColumn label="Bull" turns={bull} tone="green" />
      <DebateColumn label="Bear" turns={bear} tone="red" />
    </div>
  );
}

function DebateColumn({
  label, turns, tone,
}: {
  label: string;
  turns: Turn[];
  tone: "green" | "red";
}) {
  return (
    <div className="terminal-card overflow-hidden">
      <div
        className={cn(
          "px-4 py-2 border-b border-border text-[11px] uppercase tracking-widest",
          tone === "green" ? "text-rating-buy" : "text-rating-sell",
        )}
      >
        {label}
      </div>
      <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
        {turns.length === 0 && (
          <div className="px-4 py-3 text-text-subtle italic text-sm">No turns yet.</div>
        )}
        {turns.map((t, i) => (
          <div key={i} className="px-4 py-3 text-sm whitespace-pre-line text-text">
            <div className="text-[10px] uppercase tracking-widest text-text-subtle mb-1">
              Turn {i + 1}
            </div>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export function RiskDebatePanel({
  aggressive,
  conservative,
  neutral,
}: {
  aggressive?: string;
  conservative?: string;
  neutral?: string;
}) {
  const cols: { label: string; tone: "amber" | "cyan" | "muted"; history?: string; speakerPrefix: string }[] = [
    { label: "Aggressive",   tone: "red" as never,        history: aggressive,   speakerPrefix: "Aggressive Analyst" },
    { label: "Conservative", tone: "green" as never,      history: conservative, speakerPrefix: "Conservative Analyst" },
    { label: "Neutral",      tone: "muted" as never,      history: neutral,      speakerPrefix: "Neutral Analyst" },
  ];

  if (!aggressive && !conservative && !neutral) {
    return (
      <div className="terminal-card p-6 text-text-subtle italic">
        Risk debate hasn't started yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cols.map((c) => (
        <DebateColumn
          key={c.label}
          label={c.label}
          turns={splitTurns(c.history, c.speakerPrefix)}
          tone={c.label === "Aggressive" ? "red" : c.label === "Conservative" ? "green" : "red"}
        />
      ))}
    </div>
  );
}
