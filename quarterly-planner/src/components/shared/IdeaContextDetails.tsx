import { useWorkspaceStore } from "../../store/useWorkspaceStore";
import type { Idea } from "../../types";

/** `editable` lets a PM add context the ingestion pipeline never had (an extra
 * customer mention, a deal update) — the field the AI judge and smart defaults
 * both read from, so a later Rescore picks it up immediately. Only wired on when
 * the row itself is in edit mode (pencil clicked), never unconditionally. */
export function IdeaContextDetails({ idea, editable }: { idea: Idea; editable?: boolean }) {
  const setDescription = useWorkspaceStore((s) => s.setDescription);
  const setRawContext = useWorkspaceStore((s) => s.setRawContext);

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      {editable ? (
        <label className="flex flex-col gap-1">
          <span className="font-medium text-text-muted">What it does:</span>
          <textarea
            value={idea.description}
            onChange={(e) => setDescription(idea.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            rows={2}
            placeholder="What does this idea do?"
            className="w-full resize-y rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-secondary outline-none focus:border-accent"
          />
        </label>
      ) : (
        idea.description && (
          <p>
            <span className="font-medium text-text-muted">What it does: </span>
            <span className="text-text-secondary">{idea.description}</span>
          </p>
        )
      )}
      {editable ? (
        <label className="flex flex-col gap-1">
          <span className="font-medium text-text-muted">Raw context:</span>
          <textarea
            value={idea.rawContext}
            onChange={(e) => setRawContext(idea.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            rows={3}
            placeholder="Add anything you've heard since — another customer asking, a deal update — then Rescore below."
            className="w-full resize-y rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-secondary outline-none focus:border-accent"
          />
        </label>
      ) : (
        <p className="text-text-secondary">
          <span className="font-medium text-text-muted">Raw context: </span>
          {idea.rawContext || "No context supplied with this idea."}
        </p>
      )}
    </div>
  );
}
