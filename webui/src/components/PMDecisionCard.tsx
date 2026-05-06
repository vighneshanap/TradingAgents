import { RatingChip } from "@/components/RatingChip";
import { MarkdownView } from "@/components/MarkdownView";

import { cn } from "@/lib/utils";

function extract(md: string, label: string): string | null {
  const re = new RegExp(`\\*\\*${label}\\*\\*\\s*:\\s*([^\\n]+(?:\\n(?!\\*\\*\\w).+)*)`, "i");
  const m = md.match(re);
  return m ? m[1].trim() : null;
}

function extractRating(md: string): string {
  return extract(md, "Rating") ?? "Hold";
}

export function PMDecisionCard({ decision }: { decision?: string | null }) {
  if (!decision) {
    return (
      <div className="terminal-card p-6 text-text-subtle italic">
        Awaiting Portfolio Manager decision…
      </div>
    );
  }
  const rating = extractRating(decision);
  const summary = extract(decision, "Executive Summary");
  const thesis = extract(decision, "Investment Thesis");
  const target = extract(decision, "Price Target");
  const horizon = extract(decision, "Time Horizon");
  return (
    <div className="terminal-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-text-subtle mb-2">
            Final Decision
          </div>
          <RatingChip rating={rating} size="lg" />
        </div>
        <div className="grid grid-cols-2 gap-3 text-right">
          {target && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-text-subtle">Target</div>
              <div className="ticker text-lg numeric text-accent-cyan">{target}</div>
            </div>
          )}
          {horizon && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-text-subtle">Horizon</div>
              <div className="text-sm text-text">{horizon}</div>
            </div>
          )}
        </div>
      </div>
      {summary && (
        <div className="mt-5">
          <div className="text-[10px] uppercase tracking-widest text-text-subtle mb-1">
            Executive Summary
          </div>
          <p className="text-sm text-text leading-relaxed">{summary}</p>
        </div>
      )}
      {thesis && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-widest text-text-subtle mb-1">
            Investment Thesis
          </div>
          <p className={cn("text-sm text-text leading-relaxed whitespace-pre-line")}>{thesis}</p>
        </div>
      )}
      <details className="mt-5 text-xs text-text-muted">
        <summary className="cursor-pointer hover:text-text">Full markdown</summary>
        <div className="mt-2 border-t border-border pt-3">
          <MarkdownView md={decision} />
        </div>
      </details>
    </div>
  );
}
