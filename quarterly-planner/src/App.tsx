import { useEffect } from "react";
import { useWorkspaceStore } from "./store/useWorkspaceStore";
import { WorkspaceRail } from "./components/WorkspaceRail";
import { SuggestedNextBanner } from "./components/SuggestedNextBanner";
import { CapacityIndicator } from "./components/shared/CapacityIndicator";
import { EnrichTable } from "./components/StageEnrich/EnrichTable";
import { DiscussPanel } from "./components/StageDiscuss/DiscussPanel";
import { PlanView } from "./components/StagePlan/PlanView";
import type { Stage } from "./types";

const TITLES: Record<Stage, string> = {
  enrich: "Enrich",
  discuss: "Discuss & Adjust",
  plan: "Generate the Plan",
};

function StageContent({ stage }: { stage: Stage }) {
  switch (stage) {
    case "enrich":
      return <EnrichTable />;
    case "discuss":
      return <DiscussPanel />;
    case "plan":
      return <PlanView />;
  }
}

const SHEET_POLL_INTERVAL_MS = 60_000;

export default function App() {
  const stage = useWorkspaceStore((s) => s.stage);
  const stageSubtitle = useWorkspaceStore((s) => s.stageSubtitle);
  const syncFromSheet = useWorkspaceStore((s) => s.syncFromSheet);

  useEffect(() => {
    syncFromSheet();
    const id = setInterval(syncFromSheet, SHEET_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [syncFromSheet]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      <WorkspaceRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-6 py-3">
          <div className="min-w-0">
            <h1 className="font-serif text-lg font-medium tracking-tight">{TITLES[stage]}</h1>
            {stageSubtitle && <p className="mt-0.5 text-xs text-text-muted">{stageSubtitle}</p>}
          </div>
          {stage !== "enrich" && <CapacityIndicator />}
        </header>
        <SuggestedNextBanner />
        <main className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <StageContent stage={stage} />
        </main>
      </div>
    </div>
  );
}
