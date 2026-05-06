import { cn } from "@/lib/utils";

export function StatPill({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "amber" | "cyan" | "green" | "red";
  className?: string;
}) {
  const toneCls =
    tone === "amber" ? "text-accent-amber"
    : tone === "cyan" ? "text-accent-cyan"
    : tone === "green" ? "text-rating-buy"
    : tone === "red" ? "text-rating-sell"
    : "text-text";
  return (
    <div className={cn("terminal-card px-4 py-3", className)}>
      <div className="text-[10px] uppercase tracking-widest text-text-subtle">
        {label}
      </div>
      <div className={cn("ticker text-2xl font-semibold mt-1 numeric", toneCls)}>
        {value}
      </div>
      {hint && (
        <div className="text-[11px] text-text-muted mt-1">{hint}</div>
      )}
    </div>
  );
}
