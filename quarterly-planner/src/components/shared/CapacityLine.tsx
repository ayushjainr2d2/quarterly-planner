import { useWorkspaceStore } from "../../store/useWorkspaceStore";

export function CapacityInput() {
  const capacity = useWorkspaceStore((s) => s.workspace.capacityPersonSprints);
  const setCapacity = useWorkspaceStore((s) => s.setCapacity);

  return (
    <label className="flex items-center gap-2 text-sm text-text-muted">
      Enter your engineering capacity in person sprints:
      <input
        type="number"
        min={0}
        step={1}
        value={capacity}
        onChange={(e) => setCapacity(Number(e.target.value))}
        className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-center text-sm font-medium text-text tabular-nums outline-none focus:border-accent"
      />
    </label>
  );
}

export type CapacityStatus = "under" | "met" | "over";

export function capacityStatus(totalSprints: number, capacity: number): CapacityStatus {
  if (capacity <= 0) return totalSprints > 0 ? "over" : "met";
  const ratio = totalSprints / capacity;
  if (ratio > 1.001) return "over";
  if (ratio >= 0.999) return "met";
  return "under";
}
