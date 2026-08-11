import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useWorkspaceStore } from "../../store/useWorkspaceStore";
import { activeIdeas } from "../../lib/completion";
import {
  computeSelection,
  hasFieldInputs,
  isIdeaScored,
  scoreExplanation,
  scoreFormulaLabel,
  sprintsFromEffortScore,
} from "../../lib/scoring";
import { todayDateKey } from "../../lib/timeline";
import { CapacityInput, capacityStatus } from "../shared/CapacityLine";
import { AddFeatureButton } from "../shared/AddFeatureButton";
import { Badge } from "../shared/Badge";
import { Stepper } from "../shared/Stepper";
import { IdeaContextDetails } from "../shared/IdeaContextDetails";
import { HighlightedText } from "../shared/HighlightedText";
import { SearchInput } from "../shared/SearchInput";
import { PencilIcon, CheckIcon } from "../shared/icons";
import { FilterBar, type ScoredFilter, type RangeFilter } from "../StageEnrich/FilterBar";
import type { Comment, Framework, Idea, Source } from "../../types";

const THEMES = [
  "Security & Compliance",
  "Integrations",
  "Collaboration",
  "Reporting & Analytics",
  "Performance & Reliability",
  "Mobile",
  "Billing & Monetization",
  "Customization",
  "Onboarding & Activation",
  "Developer Platform",
];

// One consistent chip treatment for the category/owner/PRD/start-month row — same
// height, padding, radius, and border/text color language across all four, so they
// read as one metadata strip instead of four differently-styled controls.
const METADATA_CHIP = "flex h-6 items-center rounded-md border px-2 text-xs transition";
const METADATA_CHIP_FILLED = `${METADATA_CHIP} border-border bg-surface text-text`;
const METADATA_CHIP_EMPTY = `${METADATA_CHIP} border-dashed border-border text-text-faint hover:border-accent hover:text-accent`;
// Native <input> controls (especially type="month", which renders its own internal
// icon/spinner UI) misbehave under `display: flex` in Chrome — same visual chip,
// but block layout instead, sized by line-height rather than flex centering.
const METADATA_CHIP_INPUT = "h-6 rounded-md border border-border bg-surface px-2 text-xs leading-6 text-text transition";

const GRID: Record<Framework, string> = {
  RICE: "minmax(220px,1fr) 76px 76px 92px 80px 76px 96px 44px",
  value_effort: "minmax(220px,1fr) 76px 80px 76px 96px 44px",
};

interface ColumnDef {
  key: string;
  label: string;
  getValue: (idea: Idea) => number | undefined;
}

// Same fields Enrich lets you filter on — kept identical so the filter behavior doesn't diverge.
const RATING_COLUMNS: Record<Framework, ColumnDef[]> = {
  RICE: [
    { key: "reach", label: "Reach", getValue: (i) => i.scores.reach },
    { key: "impact", label: "Impact", getValue: (i) => i.scores.impact },
    { key: "confidence", label: "Confidence", getValue: (i) => i.scores.confidence },
  ],
  value_effort: [{ key: "value", label: "Value", getValue: (i) => i.scores.value }],
};

const EFFORT_COLUMN: ColumnDef = {
  key: "effort",
  label: "Effort",
  getValue: (i) => (i.scores.effort !== undefined ? sprintsFromEffortScore(i.scores.effort) : undefined),
};

function scoreColumn(framework: Framework): ColumnDef {
  return {
    key: "score",
    label: "Score",
    getValue: (i) => (isIdeaScored(i, framework) ? i.computedScore : undefined),
  };
}

/** All sortable columns, including the two the filter bar doesn't offer (Effort, Score). */
function sortColumnsFor(framework: Framework): ColumnDef[] {
  return [...RATING_COLUMNS[framework], EFFORT_COLUMN, scoreColumn(framework)];
}

type SortDir = "asc" | "desc";

function HeaderRow({
  framework,
  sortKey,
  sortDir,
  onSort,
}: {
  framework: Framework;
  sortKey: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
}) {
  return (
    <div
      className="grid items-center gap-2 border-b border-border bg-surface-2 px-4 py-2"
      style={{ gridTemplateColumns: GRID[framework] }}
    >
      <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-text">Idea</span>
      {sortColumnsFor(framework).map((col) => {
        const active = sortKey === col.key;
        return (
          <button
            key={col.key}
            onClick={() => onSort(col.key)}
            title={col.key === "score" ? `${scoreFormulaLabel(framework)}\n(click to sort)` : `Sort by ${col.label}`}
            className="group flex items-center justify-center gap-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-text hover:text-accent"
          >
            <span className="truncate">{col.label.split(" ")[0]}</span>
            <span className={`w-2.5 shrink-0 ${active ? "text-accent" : "text-text-faint opacity-0 group-hover:opacity-100"}`}>
              {active ? (sortDir === "asc" ? "↑" : "↓") : "⇅"}
            </span>
          </button>
        );
      })}
      <span />
      <span />
    </div>
  );
}

function ValueCell({
  value,
  suffix = "",
  autoFilled,
  loading,
}: {
  value: number | undefined;
  suffix?: string;
  autoFilled?: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center" title="AI is scoring this…">
        <span
          aria-hidden
          className="h-3 w-3 animate-spin rounded-full border-2 border-accent-border border-t-accent"
        />
      </div>
    );
  }

  return (
    <div
      className={`text-center text-sm tabular-nums ${
        value === undefined ? "text-text-muted" : autoFilled ? "font-medium text-accent" : "text-text"
      }`}
      title={autoFilled ? "Auto-filled from detected signal" : undefined}
    >
      {value !== undefined ? `${value}${suffix}` : "—"}
    </div>
  );
}

function ScoreCell({ idea, framework }: { idea: Idea; framework: Framework }) {
  const scored = isIdeaScored(idea, framework);
  return (
    <div
      title={scoreExplanation(idea, framework)}
      className={`text-center text-sm font-semibold tabular-nums ${scored ? "text-text" : "text-text-muted"}`}
    >
      {scored ? idea.computedScore.toFixed(2) : "—"}
    </div>
  );
}

function ScoreFields({ idea, framework }: { idea: Idea; framework: Framework }) {
  const updateScores = useWorkspaceStore((s) => s.updateScores);
  const setEffortSprints = useWorkspaceStore((s) => s.setEffortSprints);
  const effortSprints = idea.scores.effort !== undefined ? sprintsFromEffortScore(idea.scores.effort) : undefined;

  return (
    <>
      {framework === "RICE" ? (
        <>
          <Stepper
            compact
            label="Reach"
            value={idea.scores.reach}
            min={1}
            max={5}
            step={1}
            autoFilled={idea.autoFilled?.reach}
            onChange={(v) => updateScores(idea.id, { reach: v })}
          />
          <Stepper
            compact
            label="Impact"
            value={idea.scores.impact}
            min={1}
            max={5}
            step={1}
            autoFilled={idea.autoFilled?.impact}
            onChange={(v) => updateScores(idea.id, { impact: v })}
          />
          <Stepper
            compact
            label="Confidence"
            value={idea.scores.confidence}
            min={0}
            max={100}
            step={10}
            autoFilled={idea.autoFilled?.confidence}
            onChange={(v) => updateScores(idea.id, { confidence: v })}
          />
        </>
      ) : (
        <Stepper
          compact
          label="Value"
          value={idea.scores.value}
          min={1}
          max={5}
          step={1}
          autoFilled={idea.autoFilled?.value}
          onChange={(v) => updateScores(idea.id, { value: v })}
        />
      )}
      <Stepper
        compact
        label="Effort"
        value={effortSprints}
        min={0}
        step={0.5}
        suffix="sp"
        onChange={(v) => setEffortSprints(idea.id, v)}
      />
      <ScoreCell idea={idea} framework={framework} />
    </>
  );
}

function ScoreValues({ idea, framework }: { idea: Idea; framework: Framework }) {
  const aiJudgeLoading = useWorkspaceStore((s) => s.aiJudgeLoading);
  const effortSprints = idea.scores.effort !== undefined ? sprintsFromEffortScore(idea.scores.effort) : undefined;

  return (
    <>
      {framework === "RICE" ? (
        <>
          <ValueCell
            value={idea.scores.reach}
            autoFilled={idea.autoFilled?.reach}
            loading={aiJudgeLoading.has(`${idea.id}::reach`)}
          />
          <ValueCell
            value={idea.scores.impact}
            autoFilled={idea.autoFilled?.impact}
            loading={aiJudgeLoading.has(`${idea.id}::impact`)}
          />
          <ValueCell
            value={idea.scores.confidence}
            suffix="%"
            autoFilled={idea.autoFilled?.confidence}
            loading={aiJudgeLoading.has(`${idea.id}::confidence`)}
          />
        </>
      ) : (
        <ValueCell value={idea.scores.value} autoFilled={idea.autoFilled?.value} />
      )}
      <ValueCell value={effortSprints} suffix="sp" />
      <ScoreCell idea={idea} framework={framework} />
    </>
  );
}

function timeAgo(ts: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Renders "@name" tokens as styled tags — plain client-side highlighting, not validated against a user list. */
function renderCommentText(text: string) {
  return text.split(/(@[A-Za-z][\w.'-]*)/g).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="font-medium text-accent">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

const COMMENT_POPOVER_WIDTH = 288; // matches w-72

function CommentThread({ ideaId, comments }: { ideaId: string; comments: Comment[] }) {
  const addComment = useWorkspaceStore((s) => s.addComment);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus without letting the browser scroll the input into view — that scroll
    // would otherwise be caught by the close-on-scroll listener below and close
    // the popover the instant it opens.
    inputRef.current?.focus({ preventScroll: true });
    function handlePointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    // A fixed-position popover would drift from its anchor on scroll — close it instead.
    // But a long pasted comment scrolling the textbox's own content also fires "scroll"
    // (captured here regardless of bubbling) — that's not the popover drifting.
    function handleScroll(e: Event) {
      if (popoverRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  function openPopover(e: React.MouseEvent) {
    e.stopPropagation();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const left = Math.min(
        Math.max(8, rect.right - COMMENT_POPOVER_WIDTH),
        window.innerWidth - COMMENT_POPOVER_WIDTH - 8
      );
      setPos({ top: rect.bottom + 6, left });
    }
    setOpen((v) => !v);
  }

  function submit() {
    const text = draft.trim();
    if (!text) return;
    addComment(ideaId, text);
    setDraft("");
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={openPopover}
        title="Comments"
        className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium transition ${
          open || comments.length > 0
            ? "border-border text-text-muted hover:text-accent"
            : "border-transparent text-text-faint hover:border-border hover:text-accent"
        }`}
      >
        <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M2 4.5A2.5 2.5 0 0 1 4.5 2h11A2.5 2.5 0 0 1 18 4.5v7A2.5 2.5 0 0 1 15.5 14H8l-4 3.5V14H4.5A2.5 2.5 0 0 1 2 11.5v-7Z" />
        </svg>
        {comments.length > 0 && <span className="tabular-nums">{comments.length}</span>}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: COMMENT_POPOVER_WIDTH }}
            className="z-50 rounded-lg border border-border bg-surface-2 p-3 text-left shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
              {comments.length === 0 && <p className="text-xs text-text-muted">No comments yet.</p>}
              {comments.map((c) => (
                <div key={c.id} className="rounded-md bg-surface px-2 py-1.5 text-xs">
                  <p className="text-text-secondary">{renderCommentText(c.text)}</p>
                  <p className="mt-0.5 text-[10px] text-text-muted">{timeAgo(c.createdAt)}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder="Add a comment… @name to tag"
                className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
              />
              <button
                onClick={submit}
                className="shrink-0 rounded-md bg-accent px-2 py-1 text-xs font-medium text-white hover:opacity-90"
              >
                Post
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

const CATEGORY_POPOVER_WIDTH = 224; // w-56

/** The category tag, styled like the source wire-tag: click it to pick from the
 * existing category list or type to create a new one — never a plain text field. */
function CategoryTag({ ideaId, theme, options }: { ideaId: string; theme: string; options: string[] }) {
  const setTheme = useWorkspaceStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus without letting the browser scroll the input into view — that scroll
    // would otherwise be caught by the close-on-scroll listener below and close
    // the popover the instant it opens.
    inputRef.current?.focus({ preventScroll: true });
    function handlePointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    // A long pasted/typed value scrolling the search box's own content also fires
    // "scroll" (captured here regardless of bubbling) — that's not a real page scroll.
    function handleScroll(e: Event) {
      if (popoverRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  function openPopover(e: React.MouseEvent) {
    e.stopPropagation();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - CATEGORY_POPOVER_WIDTH - 8);
      setPos({ top: rect.bottom + 6, left });
    }
    setQuery("");
    setOpen((v) => !v);
  }

  function choose(value: string) {
    setTheme(ideaId, value);
    setOpen(false);
  }

  const filteredOptions = options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()));
  const exactMatch = options.some((o) => o.toLowerCase() === query.trim().toLowerCase());

  return (
    <>
      <button ref={buttonRef} onClick={openPopover} title="Set category" className="shrink-0">
        {theme ? (
          <span className={`${METADATA_CHIP_FILLED} max-w-[140px] truncate font-medium`}>{theme}</span>
        ) : (
          <span className={METADATA_CHIP_EMPTY}>+ Category</span>
        )}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: CATEGORY_POPOVER_WIDTH }}
            className="z-50 rounded-lg border border-border bg-surface-2 p-2 text-left shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) choose(query.trim());
              }}
              placeholder="Search or create…"
              className="w-full rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
            />
            <div className="mt-1.5 flex max-h-48 flex-col gap-0.5 overflow-y-auto">
              {filteredOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => choose(opt)}
                  className={`rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface ${
                    opt === theme ? "font-medium text-accent" : "text-text"
                  }`}
                >
                  {opt}
                </button>
              ))}
              {filteredOptions.length === 0 && <p className="px-2 py-1.5 text-xs text-text-muted">No matches</p>}
              {query.trim() && !exactMatch && (
                <button
                  onClick={() => choose(query.trim())}
                  className="mt-0.5 rounded-md border-t border-border px-2 py-1.5 text-left text-xs text-accent hover:bg-surface"
                >
                  + Create "{query.trim()}"
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

const PRD_POPOVER_WIDTH = 260;

/** The PRD link tag: an "Add PRD" prompt when unset, or a "PRD" hyperlink (opens in a
 * new tab) plus a small edit affordance to swap in a different link once set. */
function PrdLink({ ideaId, prdUrl }: { ideaId: string; prdUrl?: string }) {
  const setPrdUrl = useWorkspaceStore((s) => s.setPrdUrl);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus without letting the browser scroll the input into view — that scroll
    // would otherwise be caught by the close-on-scroll listener below and close
    // the popover the instant it opens.
    inputRef.current?.focus({ preventScroll: true });
    function handlePointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    // Only a real page/ancestor scroll should close this — a long pasted URL scrolling
    // the input's own text horizontally also fires a "scroll" event (captured here
    // regardless of bubbling), but that's not the popover drifting from its anchor.
    function handleScroll(e: Event) {
      if (popoverRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  function openPopover(e: React.MouseEvent) {
    e.stopPropagation();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - PRD_POPOVER_WIDTH - 8);
      setPos({ top: rect.bottom + 6, left });
    }
    setDraft(prdUrl ?? "");
    setOpen(true);
  }

  function save() {
    const url = draft.trim();
    if (url) setPrdUrl(ideaId, url);
    setOpen(false);
  }

  return (
    <>
      {prdUrl ? (
        <span className={`${METADATA_CHIP_FILLED} shrink-0 gap-1`}>
          <a
            href={prdUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-accent hover:underline"
          >
            PRD
          </a>
          <button
            ref={buttonRef}
            onClick={openPopover}
            title="Change PRD link"
            aria-label="Change PRD link"
            className="text-text-faint hover:text-accent"
          >
            <PencilIcon className="h-3 w-3" />
          </button>
        </span>
      ) : (
        <button ref={buttonRef} onClick={openPopover} className={`${METADATA_CHIP_EMPTY} shrink-0`}>
          Add PRD
        </button>
      )}

      {open &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: PRD_POPOVER_WIDTH }}
            className="z-50 rounded-lg border border-border bg-surface-2 p-2 text-left shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
              placeholder="https://…"
              className="w-full rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-muted hover:bg-surface"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
              >
                Save
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/** Native date picker (gives the browser's own calendar dropdown for free) that sets
 * exactly when work starts, used by the Timeline to place and size each idea's bar
 * (1 sprint = 14 days) and by the List view's delivery-range badge. Shows today —
 * "the most recent month" — until a PM picks something else. */
function StartDatePicker({ ideaId, startDate }: { ideaId: string; startDate?: string }) {
  const setStartDate = useWorkspaceStore((s) => s.setStartDate);
  return (
    <input
      type="date"
      title="Start date"
      value={startDate ?? todayDateKey()}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setStartDate(ideaId, e.target.value)}
      className={`${METADATA_CHIP_INPUT} w-[150px] shrink-0 outline-none focus:border-accent`}
    />
  );
}

/** The one place selection state is toggled — auto-selected ideas (within capacity,
 * in score-priority order) can be manually excluded, and vice versa. The whole
 * control (circle + "Selected"/"Not selected" tag) is one click target, not just
 * the circle, so the tag text is clickable too. */
function SelectionToggle({ selected, onToggle }: { selected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={selected ? "Selected for this quarter — click to unselect" : "Not selected — click to select"}
      aria-label={selected ? "Unselect" : "Select"}
      className="flex cursor-pointer items-center gap-1.5"
    >
      <span
        aria-hidden
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
          selected ? "border-green bg-green text-white" : "border-border text-transparent"
        }`}
      >
        <CheckIcon className="h-3.5 w-3.5" />
      </span>
      {selected ? <Badge tone="green">Selected</Badge> : <Badge tone="neutral">Not selected</Badge>}
    </button>
  );
}

function DiscussRow({
  idea,
  framework,
  selected,
  onToggleSelected,
  editable,
  editAll,
  onToggleEdit,
  themeOptions,
  searchQuery,
}: {
  idea: Idea;
  framework: Framework;
  selected: boolean;
  onToggleSelected: () => void;
  editable: boolean;
  editAll: boolean;
  onToggleEdit: () => void;
  themeOptions: string[];
  searchQuery: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const scored = hasFieldInputs(idea, framework);
  const setOwner = useWorkspaceStore((s) => s.setOwner);

  return (
    <div
      className={`overflow-hidden rounded-lg bg-surface ${
        scored ? "border border-border" : "border-y border-r border-border border-l-4 border-l-amber"
      }`}
    >
      <div
        onClick={() => setExpanded((e) => !e)}
        className="group grid cursor-pointer items-center gap-2 px-4 py-2.5 hover:bg-surface-2"
        style={{ gridTemplateColumns: GRID[framework] }}
      >
        <div className="flex min-w-0 gap-1">
          <span aria-hidden className="shrink-0 text-xs text-text-faint">
            {expanded ? "▾" : "▸"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1" onClick={(e) => e.stopPropagation()}>
              <SelectionToggle selected={selected} onToggle={onToggleSelected} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="block truncate text-left font-serif text-[15px] font-medium text-text">
                <HighlightedText text={idea.title} query={searchQuery} />
              </span>
              {!scored && <Badge tone="amber">Unscored</Badge>}
            </div>
            {idea.description && (
              <p className="mt-0.5 truncate text-xs text-text-secondary" title={idea.description}>
                {idea.description}
              </p>
            )}
            <div
              className="mt-2 flex flex-nowrap items-center gap-2 pr-2"
              onClick={(e) => e.stopPropagation()}
            >
              <CategoryTag ideaId={idea.id} theme={idea.theme} options={themeOptions} />
              <input
                value={idea.owner}
                placeholder="Add owner…"
                onChange={(e) => setOwner(idea.id, e.target.value)}
                className={`${METADATA_CHIP_FILLED} w-24 shrink-0 outline-none focus:border-accent`}
              />
              <PrdLink ideaId={idea.id} prdUrl={idea.prdUrl} />
              <StartDatePicker ideaId={idea.id} startDate={idea.startDate} />
            </div>
          </div>
        </div>

        <div className="contents" onClick={(e) => e.stopPropagation()}>
          {editable ? <ScoreFields idea={idea} framework={framework} /> : <ScoreValues idea={idea} framework={framework} />}
        </div>

        <div className="flex flex-col items-end gap-1" onClick={(e) => e.stopPropagation()}>
          {!editAll &&
            (editable ? (
              <button onClick={onToggleEdit} className="text-xs font-medium text-accent">
                Done
              </button>
            ) : (
              <button
                onClick={onToggleEdit}
                title="Edit"
                aria-label="Edit"
                className="text-text-muted opacity-0 transition hover:text-accent group-hover:opacity-100"
              >
                <PencilIcon />
              </button>
            ))}
        </div>

        <div className="flex items-center justify-center">
          <CommentThread ideaId={idea.id} comments={idea.comments ?? []} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex gap-1 bg-surface-2 px-4 py-3">
              {/* Invisible spacer matching the header's chevron + gap, so this content lines up under the title. */}
              <span aria-hidden className="shrink-0 text-xs opacity-0">
                ▸
              </span>
              <div className="min-w-0 flex-1">
                <IdeaContextDetails idea={idea} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DiscussPanel() {
  const ideas = useWorkspaceStore((s) => s.ideas);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const aiJudgeError = useWorkspaceStore((s) => s.aiJudgeError);
  const dismissAiJudgeError = useWorkspaceStore((s) => s.dismissAiJudgeError);
  const setSelectionOverride = useWorkspaceStore((s) => s.setSelectionOverride);
  const setStageSubtitle = useWorkspaceStore((s) => s.setStageSubtitle);

  const [editAll, setEditAll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<Set<Source>>(new Set());
  const [scoredFilter, setScoredFilter] = useState<ScoredFilter>("all");
  const [ranges, setRanges] = useState<Record<string, RangeFilter>>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [searchQuery, setSearchQuery] = useState("");

  const themeOptions = useMemo(() => {
    const set = new Set(THEMES);
    for (const idea of ideas) {
      if (idea.theme) set.add(idea.theme);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [ideas]);

  const framework = workspace.activeFramework;
  const columns = RATING_COLUMNS[framework];
  const sortColumns = sortColumnsFor(framework);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const activeFilterCount =
    sourceFilter.size +
    (scoredFilter !== "all" ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0) +
    Object.values(ranges).filter((r) => r.min !== undefined || r.max !== undefined).length;

  const setRange = (key: string, range: RangeFilter) => setRanges((cur) => ({ ...cur, [key]: range }));

  const removeRange = (key: string) =>
    setRanges((cur) => {
      const next = { ...cur };
      delete next[key];
      return next;
    });

  const clearFilters = () => {
    setSourceFilter(new Set());
    setScoredFilter("all");
    setRanges({});
    setSearchQuery("");
  };

  const filtered = useMemo(() => {
    let base = activeIdeas(ideas);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      base = base.filter((i) => i.title.toLowerCase().includes(q));
    }
    if (sourceFilter.size > 0) base = base.filter((i) => sourceFilter.has(i.source));
    if (scoredFilter !== "all") {
      const wantScored = scoredFilter === "scored";
      base = base.filter((i) => hasFieldInputs(i, framework) === wantScored);
    }
    for (const col of columns) {
      const range = ranges[col.key];
      if (!range || (range.min === undefined && range.max === undefined)) continue;
      base = base.filter((i) => {
        const v = col.getValue(i);
        if (v === undefined) return false;
        if (range.min !== undefined && v < range.min) return false;
        if (range.max !== undefined && v > range.max) return false;
        return true;
      });
    }

    // Always score-priority order — selection is computed against this, independent
    // of whatever column the table happens to be displayed sorted by.
    return [...base].sort((a, b) => b.computedScore - a.computedScore);
  }, [ideas, columns, sourceFilter, scoredFilter, ranges, searchQuery, framework]);

  // Selection is always computed against every active idea, never the filtered/search
  // view — otherwise narrowing the list would change which ideas rank as "auto
  // selected" and understate the real capacity total.
  const { isSelected, totalEffortSprints: totalSelectedEffortSprints } = computeSelection(
    activeIdeas(ideas),
    framework,
    workspace.capacityPersonSprints
  );
  const status = capacityStatus(totalSelectedEffortSprints, workspace.capacityPersonSprints);

  const sortCol = sortKey ? sortColumns.find((c) => c.key === sortKey) : undefined;
  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const av = sortCol.getValue(a);
        const bv = sortCol.getValue(b);
        if (av === undefined && bv === undefined) return 0;
        if (av === undefined) return 1;
        if (bv === undefined) return -1;
        return sortDir === "asc" ? av - bv : bv - av;
      })
    : filtered; // already score-priority desc

  const totalActive = activeIdeas(ideas).length;

  useEffect(() => {
    const text = `Sanity-check the set before committing${
      activeFilterCount > 0 ? ` · showing ${filtered.length} of ${totalActive}` : ""
    }.`;
    setStageSubtitle(text);
  }, [activeFilterCount, filtered.length, totalActive, setStageSubtitle]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-2">
      {status === "over" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-border bg-amber-soft px-3 py-2 text-xs text-amber">
          <span>
            {(totalSelectedEffortSprints - workspace.capacityPersonSprints).toFixed(1)} sprints over capacity —
            unselect some ideas or raise capacity.
          </span>
        </div>
      )}

      <CapacityInput />

      {aiJudgeError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red bg-red-soft px-3 py-2 text-xs text-red">
          <span>{aiJudgeError}</span>
          <button onClick={dismissAiJudgeError} className="font-medium hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={searchQuery} onChange={setSearchQuery} />
        <div className="min-w-0 flex-1">
          <FilterBar
            columns={columns}
            sourceFilter={sourceFilter}
            onSourceApply={setSourceFilter}
            scoredFilter={scoredFilter}
            onScoredApply={setScoredFilter}
            ranges={ranges}
            onRangeApply={setRange}
            onRemoveRange={removeRange}
            onResetAll={clearFilters}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => {
              setEditAll((v) => !v);
              setEditingId(null);
            }}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
              editAll
                ? "border-accent text-accent"
                : "border-border text-text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {editAll ? "Done" : "Edit Table"}
          </button>
          <AddFeatureButton />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
        <HeaderRow framework={framework} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
      </div>

      <div className="flex flex-col gap-1.5">
        {sorted.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
            No ideas match these filters.{" "}
            <button onClick={clearFilters} className="font-medium text-accent hover:underline">
              Clear filters
            </button>
          </p>
        )}
        {sorted.map((idea) => (
          <DiscussRow
            key={idea.id}
            idea={idea}
            framework={framework}
            selected={isSelected(idea)}
            onToggleSelected={() => setSelectionOverride(idea.id, !isSelected(idea))}
            editAll={editAll}
            editable={editAll || editingId === idea.id}
            onToggleEdit={() => setEditingId((cur) => (cur === idea.id ? null : idea.id))}
            themeOptions={themeOptions}
            searchQuery={searchQuery}
          />
        ))}
      </div>
    </div>
  );
}
