import { cn } from "../../utils/cn";

export function Badge({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)]",
        className
      )}
    >
      {text}
    </span>
  );
}