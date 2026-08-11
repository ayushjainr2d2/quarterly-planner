import { useMemo, useState } from "react";
import { useWorkspaceStore } from "../../store/useWorkspaceStore";
import { activeIdeas } from "../../lib/completion";
import { Badge } from "../shared/Badge";
import { isIdeaScored, sprintsFromEffortScore } from "../../lib/scoring";
import { deliveryRangeLabel } from "../../lib/timeline";
import { themeColorFor, type ThemeColor } from "../shared/themeColors";
import type { Idea } from "../../types";

function StarIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-2.5 w-2.5 shrink-0">
      <path d="M10 1.2l2.5 5.4 5.9.7-4.4 4 1.2 5.8L10 14.2l-5.2 2.9 1.2-5.8-4.4-4 5.9-.7L10 1.2z" />
    </svg>
  );
}

function IdeaRow({ idea, color }: { idea: Idea; color: ThemeColor }) {
  return (
    <div
      style={{ borderLeftColor: color.bg }}
      className="flex items-center justify-between gap-3 rounded-lg border border-l-4 border-border bg-surface px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-[15px] font-medium text-text">{idea.title}</p>
        {idea.description && (
          <p className="mt-0.5 truncate text-xs text-text-secondary" title={idea.description}>
            {idea.description}
          </p>
        )}
        <div className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
          <StarIcon />
          <span>
            {idea.owner || "Unowned"} · {sprintsFromEffortScore(idea.scores.effort ?? 0)} sprints
          </span>
        </div>
      </div>
      {idea.quarterPosition && <Badge tone="green">{deliveryRangeLabel(idea)}</Badge>}
    </div>
  );
}

function DeprioritizedRow({ idea, onRestore }: { idea: Idea; onRestore: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2 opacity-70">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-muted">{idea.title}</p>
        {idea.description && (
          <p className="mt-0.5 truncate text-xs text-text-muted" title={idea.description}>
            {idea.description}
          </p>
        )}
      </div>
      <button
        onClick={onRestore}
        className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium text-text hover:bg-surface"
      >
        Restore
      </button>
    </div>
  );
}

/** One collapsible: ideas deliberately deprioritized (scored, just not chosen) plus,
 * nested below them, ideas that simply never got scored at all — not a planning
 * decision, so it's called out separately but still lives under the same toggle. */
function NotThisQuarterSection({
  scoredIdeas,
  unscoredIdeas,
  onRestore,
}: {
  scoredIdeas: Idea[];
  unscoredIdeas: Idea[];
  onRestore: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const total = scoredIdeas.length + unscoredIdeas.length;

  return (
    <div className="mt-2 rounded-lg border border-dashed border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-text-muted hover:text-text"
      >
        <span>Not this quarter ({total})</span>
        <span>{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 border-t border-border p-2">
          {scoredIdeas.map((idea) => (
            <DeprioritizedRow key={idea.id} idea={idea} onRestore={() => onRestore(idea.id)} />
          ))}
          {unscoredIdeas.length > 0 && (
            <>
              <p className="mt-1 px-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-text-faint">
                Unscored ({unscoredIdeas.length})
              </p>
              {unscoredIdeas.map((idea) => (
                <DeprioritizedRow key={idea.id} idea={idea} onRestore={() => onRestore(idea.id)} />
              ))}
            </>
          )}
          {total === 0 && <p className="px-1 py-1 text-xs text-text-muted">Nothing deprioritized.</p>}
        </div>
      )}
    </div>
  );
}

export function ListView() {
  const ideas = useWorkspaceStore((s) => s.ideas);
  const framework = useWorkspaceStore((s) => s.workspace.activeFramework);
  const commitIdea = useWorkspaceStore((s) => s.commitIdea);

  const { groups, deprioritized, unscored } = useMemo(() => {
    const active = activeIdeas(ideas);
    const live = active.filter((i) => i.status !== "deprioritized");
    // Split "not selected" into a deliberate deprioritization (scored, just not
    // chosen) vs. simply never scored — the latter isn't a planning decision at
    // all, so it gets its own section rather than muddying "Not this quarter".
    const deprioritized = active.filter((i) => i.status === "deprioritized" && isIdeaScored(i, framework));
    const unscored = active.filter((i) => i.status === "deprioritized" && !isIdeaScored(i, framework));

    const byTheme = new Map<string, Idea[]>();
    for (const idea of live) {
      const key = idea.theme || "Untagged";
      byTheme.set(key, [...(byTheme.get(key) ?? []), idea]);
    }
    const groups = [...byTheme.entries()]
      .map(([theme, items]) => ({
        theme,
        items: items.sort((a, b) => b.computedScore - a.computedScore),
        maxScore: Math.max(...items.map((i) => i.computedScore)),
      }))
      .sort((a, b) => b.maxScore - a.maxScore);

    return { groups, deprioritized, unscored };
  }, [ideas, framework]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      {groups.map((group) => {
        const color = themeColorFor(group.theme);
        return (
          <div key={group.theme} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 px-1">
              <span
                style={{ backgroundColor: color.bg, color: color.text }}
                className="rounded-md px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide"
              >
                {group.theme}
              </span>
              <span className="text-[11px] text-text-muted">
                {group.items.length} idea{group.items.length !== 1 ? "s" : ""}
              </span>
            </div>
            {group.items.map((idea) => (
              <IdeaRow key={idea.id} idea={idea} color={color} />
            ))}
          </div>
        );
      })}

      <NotThisQuarterSection
        scoredIdeas={deprioritized}
        unscoredIdeas={unscored}
        onRestore={(id) => commitIdea(id, "Month 1")}
      />
    </div>
  );
}
