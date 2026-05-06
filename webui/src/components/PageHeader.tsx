import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "scanline relative flex items-end justify-between pb-4 mb-6 border-b border-border",
        className,
      )}
    >
      <div>
        <h1 className="text-2xl font-semibold text-text">{title}</h1>
        {subtitle && (
          <div className="text-sm text-text-muted mt-1">{subtitle}</div>
        )}
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </div>
  );
}
