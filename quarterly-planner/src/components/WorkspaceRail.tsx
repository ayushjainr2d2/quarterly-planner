import { useEffect, useState } from "react";
import { useWorkspaceStore } from "../store/useWorkspaceStore";
import { stageCompletion } from "../lib/completion";
import { ProgressPill } from "./shared/ProgressPill";
import { DocumentationButton } from "./shared/DocumentationModal";
import type { Stage } from "../types";

const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: "enrich", label: "Enrich", hint: "Score every idea" },
  { id: "discuss", label: "Discuss", hint: "Sanity-check the set" },
  { id: "plan", label: "Plan", hint: "Commit the quarter" },
];

function timeAgo(ts: number, nowTick: number): string {
  const seconds = Math.max(0, Math.round((nowTick - ts) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function SheetSyncControl() {
  const sheetSync = useWorkspaceStore((s) => s.sheetSync);
  const syncFromSheet = useWorkspaceStore((s) => s.syncFromSheet);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-2 flex flex-col gap-1">
      <button
        onClick={() => syncFromSheet()}
        disabled={sheetSync.status === "syncing"}
        className="self-start rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-text hover:bg-surface disabled:opacity-60"
      >
        {sheetSync.status === "syncing" ? "Syncing…" : "Sync from all requests"}
      </button>
      {sheetSync.status === "error" ? (
        <p className="text-[11px] text-red">{sheetSync.error}</p>
      ) : sheetSync.lastSyncedAt ? (
        <p className="text-[11px] text-text-muted">Last synced {timeAgo(sheetSync.lastSyncedAt, now)}</p>
      ) : (
        <p className="text-[11px] text-text-muted">Not synced yet — click Sync to pull the latest.</p>
      )}
    </div>
  );
}

export function WorkspaceRail() {
  const stage = useWorkspaceStore((s) => s.stage);
  const setStage = useWorkspaceStore((s) => s.setStage);
  const ideas = useWorkspaceStore((s) => s.ideas);
  const workspace = useWorkspaceStore((s) => s.workspace);

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col gap-1 border-r border-border bg-surface px-3 py-5">
      <div className="mb-4 border-b border-border px-2 pb-4">
        <p className="font-serif text-lg font-medium tracking-tight text-text">Quarterly Planner</p>
        <SheetSyncControl />
      </div>
      {STAGES.map((s, i) => {
        const completion = stageCompletion(s.id, ideas, workspace);
        const active = stage === s.id;
        return (
          <button
            key={s.id}
            onClick={() => setStage(s.id)}
            className={`flex items-start gap-2.5 rounded-md px-3 py-2.5 text-left transition ${
              active ? "bg-accent-soft text-accent" : "text-text hover:bg-surface-2"
            }`}
          >
            <span
              className={`mt-0.5 font-mono text-[11px] ${active ? "text-accent" : "text-text-faint"}`}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{s.label}</span>
                {completion.total > 0 && <ProgressPill done={completion.done} total={completion.total} />}
              </div>
              <span className={`text-xs ${active ? "text-accent/80" : "text-text-muted"}`}>{s.hint}</span>
            </div>
          </button>
        );
      })}
      <DocumentationButton />
    </nav>
  );
}
