import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useWorkspaceStore } from "../../store/useWorkspaceStore";

/** Quick-add form for an idea that never went through sheet ingestion — same
 * button + modal reused in both Enrich and Discuss. */
export function AddFeatureButton() {
  const addManualIdea = useWorkspaceStore((s) => s.addManualIdea);
  const autoJudgeAllIdeas = useWorkspaceStore((s) => s.autoJudgeAllIdeas);
  const framework = useWorkspaceStore((s) => s.workspace.activeFramework);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [generateScores, setGenerateScores] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function close() {
    setOpen(false);
    setTitle("");
    setDescription("");
    setGenerateScores(true);
    setError(null);
  }

  function submit() {
    if (!title.trim() || !description.trim()) {
      setError("Feature Title and Feature Description are both required.");
      return;
    }
    addManualIdea(title.trim(), description.trim());
    // Only the new (still-unscored) idea is affected — already-scored ideas are always skipped.
    if (generateScores) void autoJudgeAllIdeas();
    close();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-muted transition hover:border-accent hover:text-accent"
      >
        + Add Feature
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={close}>
            <div
              className="w-full max-w-md rounded-lg border border-border bg-surface-2 p-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="font-serif text-base font-medium text-text">Add a feature</p>
              <p className="mt-0.5 text-xs text-text-muted">For an idea that didn't come through the ingestion pipeline.</p>

              <label className="mt-3 block text-xs font-medium text-text-muted">
                Feature Title <span className="text-red">*</span>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Dark mode for the mobile app"
                  className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text outline-none focus:border-accent"
                />
              </label>

              <label className="mt-3 block text-xs font-medium text-text-muted">
                Feature Description <span className="text-red">*</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What it does and why it matters."
                  className="mt-1 w-full resize-none rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text outline-none focus:border-accent"
                />
              </label>

              <label className="mt-3 flex items-start gap-2 text-xs text-text-muted">
                <input
                  type="checkbox"
                  checked={generateScores}
                  onChange={(e) => setGenerateScores(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-accent"
                />
                {framework === "RICE"
                  ? "Generate Reach, Impact, and Confidence scores with AI based on the description"
                  : "Generate a Value score with AI based on the description"}
              </label>

              {error && <p className="mt-2 text-xs text-red">{error}</p>}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={close}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-surface"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                >
                  Add Feature
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
