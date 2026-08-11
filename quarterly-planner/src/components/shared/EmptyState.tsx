export function EmptyState({ action }: { action: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border py-14 text-center">
      <p className="text-sm font-medium text-text">Nothing here yet</p>
      <p className="text-sm text-text-muted">{action}</p>
    </div>
  );
}
