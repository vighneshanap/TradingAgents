import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function MarkdownView({
  md,
  className,
}: {
  md?: string | null;
  className?: string;
}) {
  if (!md || !md.trim()) {
    return (
      <div className="text-text-subtle italic text-sm">No content yet…</div>
    );
  }
  return (
    <div
      className={cn(
        "prose prose-invert prose-sm max-w-none",
        "prose-headings:font-sans prose-headings:font-semibold prose-headings:text-text",
        "prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-h3:uppercase prose-h3:tracking-wider prose-h3:text-text-muted",
        "prose-p:text-text prose-p:leading-relaxed",
        "prose-strong:text-accent-amber",
        "prose-a:text-accent-cyan prose-a:no-underline hover:prose-a:underline",
        "prose-code:font-mono prose-code:text-accent-cyan prose-code:bg-bg-overlay",
        "prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:before:content-none prose-code:after:content-none",
        "prose-table:border prose-table:border-border",
        "prose-th:border prose-th:border-border prose-th:bg-bg-overlay prose-th:px-3 prose-th:py-1.5 prose-th:text-xs prose-th:text-text-muted",
        "prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5 prose-td:text-sm",
        "prose-li:text-text prose-li:my-0.5",
        "prose-hr:border-border",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
    </div>
  );
}
