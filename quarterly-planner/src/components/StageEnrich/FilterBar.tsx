import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Source } from "../../types";

export type ScoredFilter = "all" | "scored" | "unscored";
export interface RangeFilter {
  min?: number;
  max?: number;
}
export interface ColumnFilterDef {
  key: string;
  label: string;
}

const SOURCE_LABEL: Record<Source, string> = {
  slack: "Slack",
  jira: "JIRA",
  support: "Support",
  sales: "Sales",
  exec: "Exec",
  other: "Other",
  manual: "Manual",
};
const SOURCES = Object.keys(SOURCE_LABEL) as Source[];

// Fixed pixel width, clamped to the viewport at open time — same pattern as the
// Comment/Category popovers, so no panel (including the wider Min/Max range one)
// can ever render partway off-screen the way a container-relative `w-1/2` could.
const POPOVER_WIDTH = 260;

function PopoverActions({ onCancel, onApply }: { onCancel: () => void; onApply: () => void }) {
  return (
    <div className="mt-3 flex justify-end gap-2 border-t border-border pt-2">
      <button
        onClick={onCancel}
        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-muted hover:bg-surface"
      >
        Cancel
      </button>
      <button
        onClick={onApply}
        className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
      >
        Apply
      </button>
    </div>
  );
}

export function FilterBar({
  columns,
  sourceFilter,
  onSourceApply,
  scoredFilter,
  onScoredApply,
  ranges,
  onRangeApply,
  onRemoveRange,
  onResetAll,
}: {
  columns: ColumnFilterDef[];
  sourceFilter: Set<Source>;
  onSourceApply: (v: Set<Source>) => void;
  scoredFilter: ScoredFilter;
  onScoredApply: (v: ScoredFilter) => void;
  ranges: Record<string, RangeFilter>;
  onRangeApply: (key: string, range: RangeFilter) => void;
  onRemoveRange: (key: string) => void;
  onResetAll: () => void;
}) {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [openPanel, setOpenPanel] = useState<"add" | string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [addQuery, setAddQuery] = useState("");
  const [sourceDraft, setSourceDraft] = useState<Set<Source>>(new Set());
  const [statusDraft, setStatusDraft] = useState<"scored" | "unscored">("scored");
  const [rangeDraft, setRangeDraft] = useState<RangeFilter>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!openPanel) return;
    // Focus without letting the browser scroll the input into view — that scroll
    // would otherwise be caught by the close-on-scroll listener below and close
    // the popover the instant it opens.
    if (openPanel === "add") addInputRef.current?.focus({ preventScroll: true });
    function handlePointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpenPanel(null);
    }
    // A fixed-position popover would drift from its anchor on scroll — close it instead.
    // But a long pasted/typed value scrolling an input's own content also fires
    // "scroll" (captured here regardless of bubbling) — that's not a real page scroll.
    function handleScroll(e: Event) {
      if (popoverRef.current?.contains(e.target as Node)) return;
      setOpenPanel(null);
    }
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [openPanel]);

  // Position from the trigger's *current* DOM location rather than a rect captured at
  // click time — a newly-added chip doesn't exist in the DOM yet when its "+ Filter"
  // menu item is clicked, so capturing then would anchor the popover to the menu instead
  // of the chip. Running after commit (layout effect) guarantees the chip is there.
  useLayoutEffect(() => {
    if (!openPanel) return;
    const trigger = rootRef.current?.querySelector<HTMLElement>(`[data-filter-key="${openPanel}"]`);
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - POPOVER_WIDTH - 8);
    setPos({ top: rect.bottom + 6, left });
  }, [openPanel, activeKeys]);

  const allFields = [{ key: "source", label: "Source" }, { key: "status", label: "Status" }, ...columns];
  const availableToAdd = allFields.filter(
    (f) => !activeKeys.includes(f.key) && f.label.toLowerCase().includes(addQuery.toLowerCase())
  );

  function openField(key: string) {
    if (key === "source") setSourceDraft(new Set(sourceFilter));
    else if (key === "status") setStatusDraft(scoredFilter === "unscored" ? "unscored" : "scored");
    else setRangeDraft(ranges[key] ?? {});
    setOpenPanel(key);
  }

  function toggleField(key: string) {
    if (openPanel === key) setOpenPanel(null);
    else openField(key);
  }

  function addField(key: string) {
    setActiveKeys((k) => [...k, key]);
    setAddQuery("");
    openField(key);
  }

  function removeField(key: string) {
    setActiveKeys((k) => k.filter((x) => x !== key));
    if (openPanel === key) setOpenPanel(null);
    if (key === "source") onSourceApply(new Set());
    else if (key === "status") onScoredApply("all");
    else onRemoveRange(key);
  }

  function applyOpen() {
    if (openPanel === "source") onSourceApply(sourceDraft);
    else if (openPanel === "status") onScoredApply(statusDraft);
    else if (openPanel) onRangeApply(openPanel, rangeDraft);
    setOpenPanel(null);
  }

  function summaryFor(key: string): string {
    if (key === "source") return sourceFilter.size === 0 ? "Any" : [...sourceFilter].map((s) => SOURCE_LABEL[s]).join(", ");
    if (key === "status") return scoredFilter === "all" ? "Any" : scoredFilter === "scored" ? "Scored" : "Unscored";
    const r = ranges[key];
    return !r || (r.min === undefined && r.max === undefined) ? "Any" : `${r.min ?? "–"}–${r.max ?? "–"}`;
  }

  const anyActive =
    sourceFilter.size > 0 ||
    scoredFilter !== "all" ||
    Object.values(ranges).some((r) => r.min !== undefined || r.max !== undefined);

  return (
    <div ref={rootRef} className="relative">
      <div className="flex flex-wrap items-center gap-2">
        {activeKeys.map((key) => {
          const field = allFields.find((f) => f.key === key);
          if (!field) return null;
          return (
            <div
              key={key}
              className={`flex items-stretch overflow-hidden rounded-md border text-xs ${
                openPanel === key ? "border-accent" : "border-border"
              } bg-surface`}
            >
              <button
                data-filter-key={key}
                onClick={() => toggleField(key)}
                className="flex items-center gap-1 px-2.5 py-1.5 font-medium text-text hover:bg-surface-2"
              >
                {field.label}: <span className="text-text-muted">{summaryFor(key)}</span>
                <span className="text-text-faint">▾</span>
              </button>
              <button
                onClick={() => removeField(key)}
                aria-label={`Remove ${field.label} filter`}
                className="flex items-center border-l border-border px-2 text-text-faint hover:bg-surface-2 hover:text-text"
              >
                ✕
              </button>
            </div>
          );
        })}

        {availableToAdd.length > 0 && (
          <button
            data-filter-key="add"
            onClick={() => setOpenPanel((cur) => (cur === "add" ? null : "add"))}
            className={`rounded-md border border-dashed px-2.5 py-1.5 text-xs font-medium transition ${
              openPanel === "add" ? "border-accent text-accent" : "border-border text-text-muted hover:border-accent hover:text-accent"
            }`}
          >
            + Filter
          </button>
        )}

        {anyActive && (
          <button
            onClick={() => {
              onResetAll();
              setActiveKeys([]);
              setOpenPanel(null);
            }}
            className="text-xs font-medium text-accent hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      {openPanel &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: POPOVER_WIDTH }}
            className="z-50 rounded-lg border border-border bg-surface-2 p-3 text-left shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {openPanel === "add" && (
              <>
                <input
                  ref={addInputRef}
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
                <div className="mt-2 flex max-h-48 flex-col gap-0.5 overflow-y-auto">
                  {availableToAdd.length === 0 && <p className="px-2 py-1.5 text-xs text-text-muted">No matches</p>}
                  {availableToAdd.map((o) => (
                    <button
                      key={o.key}
                      onClick={() => addField(o.key)}
                      className="rounded-md px-2 py-1.5 text-left text-xs text-text hover:bg-surface"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {openPanel === "source" && (
              <>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {SOURCES.map((s) => (
                    <label key={s} className="flex items-center gap-1.5 text-xs text-text">
                      <input
                        type="checkbox"
                        checked={sourceDraft.has(s)}
                        onChange={() =>
                          setSourceDraft((cur) => {
                            const next = new Set(cur);
                            if (next.has(s)) next.delete(s);
                            else next.add(s);
                            return next;
                          })
                        }
                      />
                      {SOURCE_LABEL[s]}
                    </label>
                  ))}
                </div>
                <PopoverActions onCancel={() => setOpenPanel(null)} onApply={applyOpen} />
              </>
            )}

            {openPanel === "status" && (
              <>
                <div className="flex items-center gap-4">
                  {(["scored", "unscored"] as const).map((opt) => (
                    <label key={opt} className="flex items-center gap-1.5 text-xs capitalize text-text">
                      <input
                        type="radio"
                        name="status-filter"
                        checked={statusDraft === opt}
                        onChange={() => setStatusDraft(opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
                <PopoverActions onCancel={() => setOpenPanel(null)} onApply={applyOpen} />
              </>
            )}

            {openPanel !== "add" && openPanel !== "source" && openPanel !== "status" && (
              <>
                <div className="flex items-center gap-3">
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-text-muted">
                    Min
                    <input
                      type="number"
                      value={rangeDraft.min ?? ""}
                      onChange={(e) =>
                        setRangeDraft((d) => ({ ...d, min: e.target.value === "" ? undefined : Number(e.target.value) }))
                      }
                      className="w-full min-w-0 rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
                    />
                  </label>
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-text-muted">
                    Max
                    <input
                      type="number"
                      value={rangeDraft.max ?? ""}
                      onChange={(e) =>
                        setRangeDraft((d) => ({ ...d, max: e.target.value === "" ? undefined : Number(e.target.value) }))
                      }
                      className="w-full min-w-0 rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-accent"
                    />
                  </label>
                </div>
                <PopoverActions onCancel={() => setOpenPanel(null)} onApply={applyOpen} />
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
