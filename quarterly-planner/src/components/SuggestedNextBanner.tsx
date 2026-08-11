import { useEffect, useRef } from "react";
import { useWorkspaceStore } from "../store/useWorkspaceStore";
import { stageCompletion } from "../lib/completion";
import type { Stage } from "../types";

const NEXT: Partial<Record<Stage, { stage: Stage; message: string; cta: string }>> = {
  enrich: { stage: "discuss", message: "All ideas scored — sanity-check them next.", cta: "Go to Discuss" },
};

export function SuggestedNextBanner() {
  const stage = useWorkspaceStore((s) => s.stage);
  const ideas = useWorkspaceStore((s) => s.ideas);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const dismissedBanners = useWorkspaceStore((s) => s.dismissedBanners);
  const dismissBanner = useWorkspaceStore((s) => s.dismissBanner);
  const rearmBanner = useWorkspaceStore((s) => s.rearmBanner);
  const setStage = useWorkspaceStore((s) => s.setStage);

  const completion = stageCompletion(stage, ideas, workspace);
  const isComplete = completion.total > 0 && completion.done === completion.total;

  // A dismissal is meant to last only until the milestone is freshly re-reached
  // (e.g. a new idea drops completion below 100%, then gets scored back up) —
  // not forever. Re-arm the banner whenever we see a fresh incomplete→complete edge.
  const wasComplete = useRef<Partial<Record<Stage, boolean>>>({});
  useEffect(() => {
    if (isComplete && !wasComplete.current[stage] && dismissedBanners[stage]) {
      rearmBanner(stage);
    }
    wasComplete.current[stage] = isComplete;
  }, [stage, isComplete, dismissedBanners, rearmBanner]);

  const next = NEXT[stage];
  if (!next) return null;
  if (dismissedBanners[stage]) return null;
  if (!isComplete) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-accent-border bg-accent-soft px-6 py-2.5 text-sm">
      <span className="text-accent">{next.message}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setStage(next.stage)}
          className="rounded-md bg-accent px-3 py-1 font-medium text-white hover:opacity-90"
        >
          {next.cta}
        </button>
        <button
          onClick={() => dismissBanner(stage)}
          aria-label="Dismiss"
          className="text-accent/70 hover:text-accent"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
