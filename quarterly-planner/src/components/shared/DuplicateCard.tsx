import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useWorkspaceStore } from "../../store/useWorkspaceStore";
import { IdeaContextDetails } from "./IdeaContextDetails";
import type { Idea } from "../../types";

function IdeaChip({ idea, expanded, onToggle }: { idea: Idea; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="min-w-0 flex-1">
      <button
        onClick={onToggle}
        className={`w-full truncate rounded-md border px-2.5 py-1.5 text-left text-sm transition ${
          expanded
            ? "border-accent bg-surface text-text"
            : "border-transparent bg-surface/60 text-text hover:border-amber-border hover:bg-surface"
        }`}
      >
        "{idea.title}" <span className="text-text-muted">({idea.source})</span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-1 rounded-md bg-surface px-2.5 py-2">
              <IdeaContextDetails idea={idea} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DuplicateCard({ a, b }: { a: Idea; b: Idea }) {
  const mergeIdeas = useWorkspaceStore((s) => s.mergeIdeas);
  const dismissDuplicatePair = useWorkspaceStore((s) => s.dismissDuplicatePair);
  const [expandedA, setExpandedA] = useState(false);
  const [expandedB, setExpandedB] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-border bg-amber-soft px-4 py-2.5">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-xs font-semibold uppercase tracking-wider text-amber">Possible duplicate</p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => mergeIdeas(a.id, b.id)}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Merge
          </button>
          <button
            onClick={() => dismissDuplicatePair(a.id, b.id)}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-surface"
          >
            Dismiss
          </button>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <IdeaChip idea={a} expanded={expandedA} onToggle={() => setExpandedA((v) => !v)} />
        <span className="mt-1.5 text-text-muted">↔</span>
        <IdeaChip idea={b} expanded={expandedB} onToggle={() => setExpandedB((v) => !v)} />
      </div>
    </div>
  );
}
