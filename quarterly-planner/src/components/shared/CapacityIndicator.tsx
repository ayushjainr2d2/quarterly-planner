import { useWorkspaceStore } from "../../store/useWorkspaceStore";
import { computeSelection } from "../../lib/scoring";
import { activeIdeas } from "../../lib/completion";

export function CapacityIndicator() {
  const ideas = useWorkspaceStore((s) => s.ideas);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const capacity = workspace.capacityPersonSprints;

  const { totalEffortSprints } = computeSelection(activeIdeas(ideas), workspace.activeFramework, capacity);
  const over = totalEffortSprints > capacity;
  const pct = capacity > 0 ? Math.min(100, (totalEffortSprints / capacity) * 100) : totalEffortSprints > 0 ? 100 : 0;

  return (
    <div className="flex items-center gap-2.5 text-xs">
      <span className="whitespace-nowrap text-text-muted">
        <span className={`font-semibold tabular-nums ${over ? "text-amber" : "text-text"}`}>
          {totalEffortSprints.toFixed(1)}
        </span>
        {" / "}
        {capacity} sprints
      </span>
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${over ? "bg-amber" : "bg-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {over && <span className="whitespace-nowrap font-medium text-amber">Over capacity</span>}
    </div>
  );
}
