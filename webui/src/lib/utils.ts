import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatPct(s?: string | null): string {
  if (!s || s === "n/a") return "—";
  return s;
}

export function pctColor(s?: string | null): string {
  if (!s || s === "n/a") return "text-text-subtle";
  return s.startsWith("-") ? "text-rating-sell" : "text-rating-buy";
}

export function relTime(iso?: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
