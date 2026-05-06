import { cn } from "@/lib/utils";
import type { Rating } from "@/types";

const COLORS: Record<string, string> = {
  Buy:         "bg-rating-buy/15         text-rating-buy         border-rating-buy/40",
  Overweight:  "bg-rating-overweight/15  text-rating-overweight  border-rating-overweight/40",
  Hold:        "bg-rating-hold/15        text-rating-hold        border-rating-hold/40",
  Underweight: "bg-rating-underweight/15 text-rating-underweight border-rating-underweight/40",
  Sell:        "bg-rating-sell/15        text-rating-sell        border-rating-sell/40",
};

export function RatingChip({
  rating,
  size = "md",
}: {
  rating?: Rating | string | null;
  size?: "sm" | "md" | "lg";
}) {
  const r = (rating ?? "Hold") as keyof typeof COLORS;
  const cls = COLORS[r] ?? COLORS.Hold;
  const sizing = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-3 py-1 text-xs",
    lg: "px-4 py-1.5 text-sm",
  }[size];
  return (
    <span
      className={cn(
        "ticker uppercase border rounded-sm font-semibold tracking-ticker",
        cls,
        sizing,
      )}
    >
      {r}
    </span>
  );
}
