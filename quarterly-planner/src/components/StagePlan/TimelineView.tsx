import { useMemo, useState } from "react";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { useWorkspaceStore } from "../../store/useWorkspaceStore";
import { activeIdeas } from "../../lib/completion";
import { sprintsFromEffortScore } from "../../lib/scoring";
import { MONTHS } from "../../lib/plan";
import { computeBarPlacement, dateKeyForIndex, deliveryRangeLabel, monthLabel } from "../../lib/timeline";
import { themeColorFor, type ThemeColor } from "../shared/themeColors";
import type { Idea } from "../../types";

const NOT_THIS_QUARTER = "not_this_quarter";

function StarIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-2.5 w-2.5 shrink-0">
      <path d="M10 1.2l2.5 5.4 5.9.7-4.4 4 1.2 5.8L10 14.2l-5.2 2.9 1.2-5.8-4.4-4 5.9-.7L10 1.2z" />
    </svg>
  );
}

/** A true Gantt bar: horizontal offset/width are day-precise percentages of the
 * 3-month track, from computeBarPlacement (exact start date + 1-sprint-=-14-days
 * duration, measured against the real calendar). */
function Bar({ idea, color }: { idea: Idea; color: ThemeColor }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: idea.id });
  const { leftPct, widthPct } = computeBarPlacement(idea);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        marginLeft: `${leftPct}%`,
        width: `calc(${widthPct}% - 6px)`,
        backgroundColor: color.bg,
        color: color.text,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      title={deliveryRangeLabel(idea)}
      className={`cursor-grab touch-none rounded-md px-2.5 py-1.5 shadow-sm active:cursor-grabbing ${
        isDragging ? "z-10 opacity-90 shadow-lg" : ""
      }`}
    >
      <p className="truncate text-xs font-semibold">{idea.title}</p>
      <div className="mt-0.5 flex items-center gap-1 text-[10px] opacity-90">
        <StarIcon />
        <span>
          {idea.owner || "Unowned"} · {sprintsFromEffortScore(idea.scores.effort ?? 0)}sp
        </span>
      </div>
    </div>
  );
}

function MonthDropZone({ id, color }: { id: string; color: ThemeColor }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ backgroundColor: isOver ? color.soft : undefined }}
      className="h-full border-l border-border transition-colors"
    />
  );
}

function ThemeRow({ theme, ideas, color, first }: { theme: string; ideas: Idea[]; color: ThemeColor; first: boolean }) {
  return (
    <div
      className={`grid ${first ? "" : "border-t border-border"}`}
      style={{ gridTemplateColumns: "180px repeat(3, 1fr)" }}
    >
      <div
        style={{ backgroundColor: color.bg, color: color.text }}
        className="flex flex-col justify-center gap-0.5 px-3 py-3"
      >
        <p className="font-serif text-sm font-semibold">{theme}</p>
        <p className="text-[11px] opacity-90">
          {ideas.length} idea{ideas.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Drop-target background, one cell per month. Bars sit in normal flow (not
          absolutely positioned) so a theme with several stacked ideas grows the
          row's real height instead of overflowing/overlapping the row below;
          the background then stretches via inset-0 to match. */}
      <div className="relative col-span-3 min-h-[68px]">
        <div className="absolute inset-0 grid grid-cols-3">
          {MONTHS.map((month) => (
            <MonthDropZone key={month} id={`${theme}::${month}`} color={color} />
          ))}
        </div>
        <div className="relative flex flex-col gap-1.5 py-2">
          {ideas.map((idea) => (
            <Bar key={idea.id} idea={idea} color={color} />
          ))}
        </div>
      </div>
    </div>
  );
}

function HeaderRow() {
  return (
    <div className="grid border-b border-border bg-surface-2" style={{ gridTemplateColumns: "180px repeat(3, 1fr)" }}>
      <span className="px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-text">Product</span>
      {MONTHS.map((month, i) => (
        <span
          key={month}
          className="border-l border-border px-3 py-2 text-center font-mono text-[11px] font-semibold uppercase tracking-wide text-text"
        >
          {monthLabel(i)}
        </span>
      ))}
    </div>
  );
}

export function TimelineView() {
  const ideas = useWorkspaceStore((s) => s.ideas);
  const setQuarterPosition = useWorkspaceStore((s) => s.setQuarterPosition);
  const setStartDate = useWorkspaceStore((s) => s.setStartDate);
  const deprioritizeIdea = useWorkspaceStore((s) => s.deprioritizeIdea);
  const [collapsed, setCollapsed] = useState(true);

  const active = activeIdeas(ideas);
  const committed = active.filter((i) => i.status === "committed");
  const deprioritized = active.filter((i) => i.status === "deprioritized");

  const groups = useMemo(() => {
    const byTheme = new Map<string, Idea[]>();
    for (const idea of committed) {
      const key = idea.theme || "Untagged";
      byTheme.set(key, [...(byTheme.get(key) ?? []), idea]);
    }
    return [...byTheme.entries()]
      .map(([theme, items]) => ({ theme, items, maxScore: Math.max(...items.map((i) => i.computedScore)) }))
      .sort((a, b) => b.maxScore - a.maxScore);
  }, [committed]);

  function handleDragEnd(e: DragEndEvent) {
    const ideaId = e.active.id as string;
    const target = e.over?.id as string | undefined;
    if (!target) return;

    if (target === NOT_THIS_QUARTER) {
      deprioritizeIdea(ideaId);
      return;
    }

    const separator = target.lastIndexOf("::");
    if (separator === -1) return;
    const rowTheme = target.slice(0, separator);
    const month = target.slice(separator + 2);

    const idea = committed.find((i) => i.id === ideaId);
    if (!idea || (idea.theme || "Untagged") !== rowTheme) return; // rows are per-theme; this view doesn't retag
    const monthIndex = (MONTHS as readonly string[]).indexOf(month);
    if (monthIndex !== -1) {
      setQuarterPosition(ideaId, month);
      setStartDate(ideaId, dateKeyForIndex(monthIndex));
    }
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-xl border border-border">
          <HeaderRow />
          {groups.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-text-muted">Nothing committed to the quarter yet.</p>
          )}
          {groups.map((g, i) => (
            <ThemeRow key={g.theme} theme={g.theme} ideas={g.items} color={themeColorFor(g.theme)} first={i === 0} />
          ))}
        </div>

        <NotThisQuarterSection ideas={deprioritized} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>
    </DndContext>
  );
}

function NotThisQuarterSection({
  ideas,
  collapsed,
  onToggle,
}: {
  ideas: Idea[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: NOT_THIS_QUARTER });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border border-dashed p-3 transition-colors ${
        isOver ? "border-amber bg-amber-soft" : "border-border"
      }`}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between text-xs font-medium text-text-muted hover:text-text"
      >
        <span>Not this quarter ({ideas.length}) — drag a bar here to deprioritize</span>
        <span>{collapsed ? "Show" : "Hide"}</span>
      </button>
      {!collapsed && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {ideas.map((idea) => (
            <div key={idea.id} className="rounded-md border border-border bg-surface px-2.5 py-1.5">
              <p className="truncate font-serif text-[13px] font-medium text-text">{idea.title}</p>
              <p className="mt-0.5 text-[10px] text-text-muted">{idea.theme || "Untagged"}</p>
            </div>
          ))}
          {ideas.length === 0 && <p className="col-span-3 px-1 py-1 text-xs text-text-muted">Nothing deprioritized.</p>}
        </div>
      )}
    </div>
  );
}
