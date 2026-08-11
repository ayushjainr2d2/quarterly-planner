import { useEffect, useState } from "react";
import { useWorkspaceStore } from "../../store/useWorkspaceStore";
import { ListView } from "./ListView";
import { TimelineView } from "./TimelineView";

export function PlanView() {
  const [view, setView] = useState<"list" | "timeline">("list");
  const autoGeneratePlan = useWorkspaceStore((s) => s.autoGeneratePlan);
  const setStageSubtitle = useWorkspaceStore((s) => s.setStageSubtitle);

  useEffect(() => {
    autoGeneratePlan();
  }, [autoGeneratePlan]);

  useEffect(() => {
    setStageSubtitle(
      view === "list" ? "Ranked by score, grouped by theme." : "Drag ideas between months, or into “Not this quarter.”"
    );
  }, [view, setStageSubtitle]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex items-center justify-end">
        <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
          {(["list", "timeline"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                view === v ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "list" ? <ListView /> : <TimelineView />}
    </div>
  );
}
