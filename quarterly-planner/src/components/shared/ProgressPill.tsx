export function ProgressPill({ done, total }: { done: number; total: number }) {
  const complete = total > 0 && done === total;
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
        complete ? "bg-green-soft text-green" : "bg-surface-2 text-text-muted"
      }`}
    >
      {done}/{total}
    </span>
  );
}
