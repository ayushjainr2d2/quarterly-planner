import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWorkspaceStore } from "../../store/useWorkspaceStore";
import { activeIdeas, enrichCompletion } from "../../lib/completion";
import { hasFieldInputs } from "../../lib/scoring";
import { signalSummary } from "../../lib/smartDefaults";
import { daysUntilPurge, ARCHIVE_RETENTION_DAYS, DONE_RETENTION_DAYS } from "../../lib/archive";
import { HighlightedText } from "../shared/HighlightedText";
import { SearchInput } from "../shared/SearchInput";
import { PencilIcon, CheckIcon, TrashIcon } from "../shared/icons";
import type { Framework, Idea, Source } from "../../types";
import { Stepper } from "../shared/Stepper";
import { Badge } from "../shared/Badge";
import { DuplicateCard } from "../shared/DuplicateCard";
import { IdeaContextDetails } from "../shared/IdeaContextDetails";
import { FrameworkSwitcher } from "../shared/FrameworkSwitcher";
import { AddFeatureButton } from "../shared/AddFeatureButton";
import { FilterBar, type ScoredFilter, type RangeFilter } from "./FilterBar";

const SOURCE_LABEL: Record<Source, string> = {
  slack: "Slack",
  jira: "JIRA",
  support: "Support",
  sales: "Sales",
  exec: "Exec",
  other: "Other",
  manual: "Manual",
};

const GRID: Record<Framework, string> = {
  RICE: "minmax(240px,1fr) 76px 76px 92px 104px",
  value_effort: "minmax(240px,1fr) 76px 104px",
};

interface ColumnDef {
  key: string;
  label: string;
  getValue: (idea: Idea) => number | undefined;
}

const COLUMNS: Record<Framework, ColumnDef[]> = {
  RICE: [
    { key: "reach", label: "Reach", getValue: (i) => i.scores.reach },
    { key: "impact", label: "Impact", getValue: (i) => i.scores.impact },
    { key: "confidence", label: "Confidence", getValue: (i) => i.scores.confidence },
  ],
  value_effort: [{ key: "value", label: "Value", getValue: (i) => i.scores.value }],
};

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
      {COLUMNS[framework].map((col) => {
        const active = sortKey === col.key;
        return (
          <button
            key={col.key}
            onClick={() => onSort(col.key)}
            title={`Sort by ${col.label}`}
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

function ScoreFields({ idea, framework }: { idea: Idea; framework: Framework }) {
  const updateScores = useWorkspaceStore((s) => s.updateScores);

  if (framework === "RICE") {
    return (
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
    );
  }

  return (
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
  );
}

function ScoreValues({ idea, framework }: { idea: Idea; framework: Framework }) {
  const aiJudgeLoading = useWorkspaceStore((s) => s.aiJudgeLoading);

  if (framework === "RICE") {
    return (
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
    );
  }

  return <ValueCell value={idea.scores.value} autoFilled={idea.autoFilled?.value} />;
}

/** Always shows the "why" behind a scored field — either the AI judge's own
 * rationale, or (when the value came from the regex-based smart defaults, not
 * a judge call) the detected signal that produced it. Only unset fields fall
 * back to a plain "Suggest" prompt. */
function FieldAiSuggestion({
  idea,
  field,
  label,
  suffix = "",
  onRequest,
}: {
  idea: Idea;
  field: "reach" | "impact" | "confidence";
  label: string;
  suffix?: string;
  onRequest: () => void;
}) {
  const ideaId = idea.id;
  const suggestion = useWorkspaceStore((s) => s.pendingAiSuggestions[ideaId]?.[field]);
  const loading = useWorkspaceStore((s) => s.aiJudgeLoading.has(`${ideaId}::${field}`));
  const dismissAiSuggestion = useWorkspaceStore((s) => s.dismissAiSuggestion);
  const [signalDismissed, setSignalDismissed] = useState(false);

  if (loading) {
    return <p className="mt-2 text-xs text-text-muted">Asking AI for a {label} suggestion…</p>;
  }

  const value = idea.scores[field];
  const signal = signalSummary(idea.rawContext);

  // One consistent line regardless of source (AI judge vs. regex smart defaults) —
  // only the rationale text and dismiss behavior differ underneath.
  const rationale = suggestion
    ? { value: suggestion.value, text: suggestion.rationale, onDismiss: () => dismissAiSuggestion(ideaId, field) }
    : value !== undefined && idea.autoFilled?.[field] && signal && !signalDismissed
      ? { value, text: signal, onDismiss: () => setSignalDismissed(true) }
      : null;

  if (rationale) {
    return (
      <div className="mt-2 flex items-center justify-between gap-3 rounded-md bg-accent-soft px-3 py-2 text-xs">
        <span className="text-accent">
          <span className="font-semibold">{label}:</span> Auto-filled {label} to {rationale.value}
          {suffix} — {rationale.text}
        </span>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onRequest}
            className="rounded-md border border-accent-border px-2 py-1 font-medium text-accent hover:bg-surface"
          >
            Rescore
          </button>
          <button
            onClick={rationale.onDismiss}
            className="rounded-md border border-accent-border px-2 py-1 font-medium text-accent hover:bg-surface"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  if (value !== undefined) return null;

  return (
    <button onClick={onRequest} className="mt-2 block text-left text-xs font-medium text-accent hover:underline">
      Suggest {label} (AI)
    </button>
  );
}

function EnrichRow({
  idea,
  framework,
  editable,
  onToggleEdit,
  editAll,
  searchQuery,
}: {
  idea: Idea;
  framework: Framework;
  editable: boolean;
  editAll: boolean;
  onToggleEdit: () => void;
  searchQuery: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const scored = hasFieldInputs(idea, framework);
  const signal = signalSummary(idea.rawContext);
  const setTitle = useWorkspaceStore((s) => s.setTitle);
  const archiveIdea = useWorkspaceStore((s) => s.archiveIdea);
  const markIdeaDone = useWorkspaceStore((s) => s.markIdeaDone);
  const requestReachSuggestion = useWorkspaceStore((s) => s.requestReachSuggestion);
  const requestImpactSuggestion = useWorkspaceStore((s) => s.requestImpactSuggestion);
  const requestConfidenceSuggestion = useWorkspaceStore((s) => s.requestConfidenceSuggestion);

  return (
    <div
      className={`overflow-hidden rounded-lg bg-surface ${
        scored ? "border border-border" : "border-y border-r border-border border-l-4 border-l-amber"
      }`}
    >
      <div
        onClick={() => setExpanded((e) => !e)}
        className="group grid cursor-pointer items-start gap-2 px-4 py-2.5 hover:bg-surface-2"
        style={{ gridTemplateColumns: GRID[framework] }}
      >
        <div className="flex min-w-0 gap-1">
          <span aria-hidden className="shrink-0 pt-1 text-xs text-text-faint">
            {expanded ? "▾" : "▸"}
          </span>
          <div className="min-w-0 flex-1">
            {editable ? (
              <input
                value={idea.title}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setTitle(idea.id, e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-1.5 py-1 text-sm font-medium text-text outline-none focus:border-accent"
              />
            ) : (
              <span className="block truncate text-left font-serif text-[15px] font-medium text-text">
                <HighlightedText text={idea.title} query={searchQuery} />
              </span>
            )}
            {idea.description && (
              <p className="mt-0.5 truncate text-xs text-text-secondary" title={idea.description}>
                {idea.description}
              </p>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Badge>{`[${SOURCE_LABEL[idea.source]}]`}</Badge>
              {!scored && <Badge tone="amber">Unscored</Badge>}
              {signal && <span className="truncate text-xs text-text-muted" title={signal}>{signal}</span>}
            </div>
          </div>
        </div>

        <div className="contents" onClick={(e) => e.stopPropagation()}>
          {editable ? <ScoreFields idea={idea} framework={framework} /> : <ScoreValues idea={idea} framework={framework} />}
        </div>

        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          {!editAll &&
            (editable ? (
              <button onClick={onToggleEdit} className="text-xs font-medium text-accent">
                Done
              </button>
            ) : (
              <>
                <button
                  onClick={onToggleEdit}
                  title="Edit"
                  aria-label="Edit"
                  className="text-text-muted opacity-0 transition hover:text-accent group-hover:opacity-100"
                >
                  <PencilIcon />
                </button>
                <button
                  onClick={() => markIdeaDone(idea.id)}
                  title="Mark done"
                  aria-label="Mark done"
                  className="text-text-muted opacity-0 transition hover:text-green group-hover:opacity-100"
                >
                  <CheckIcon />
                </button>
                <button
                  onClick={() => archiveIdea(idea.id)}
                  title="Archive"
                  aria-label="Archive"
                  className="text-text-muted opacity-0 transition hover:text-red group-hover:opacity-100"
                >
                  <TrashIcon />
                </button>
              </>
            ))}
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
                <IdeaContextDetails idea={idea} editable={editable} />
                {framework === "RICE" && (
                  <>
                    <FieldAiSuggestion
                      idea={idea}
                      field="reach"
                      label="Reach"
                      onRequest={() => requestReachSuggestion(idea.id)}
                    />
                    <FieldAiSuggestion
                      idea={idea}
                      field="impact"
                      label="Impact"
                      onRequest={() => requestImpactSuggestion(idea.id)}
                    />
                    <FieldAiSuggestion
                      idea={idea}
                      field="confidence"
                      label="Confidence"
                      suffix="%"
                      onRequest={() => requestConfidenceSuggestion(idea.id)}
                    />
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CollapsibleSection({
  label,
  count,
  defaultOpen = false,
  children,
}: {
  label: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;

  return (
    <div className="mt-2 border-t border-border pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-accent"
      >
        <span aria-hidden className="text-text-faint">{open ? "▾" : "▸"}</span>
        {label} ({count})
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex flex-col gap-1.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShelvedRow({
  idea,
  timestamp,
  retentionDays,
  restoreLabel,
  onRestore,
}: {
  idea: Idea;
  timestamp: string;
  retentionDays: number;
  restoreLabel: string;
  onRestore: () => void;
}) {
  const daysLeft = daysUntilPurge(timestamp, retentionDays);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <span className="block truncate font-serif text-[15px] font-medium text-text-secondary">{idea.title}</span>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <Badge>{`[${SOURCE_LABEL[idea.source]}]`}</Badge>
          <span className="text-xs text-text-muted">
            {daysLeft > 0 ? `Removed permanently in ${daysLeft} day${daysLeft === 1 ? "" : "s"}` : "Removed permanently soon"}
          </span>
        </div>
      </div>
      <button
        onClick={onRestore}
        className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-muted transition hover:border-accent hover:text-accent"
      >
        {restoreLabel}
      </button>
    </div>
  );
}

function ShelvedSection({
  label,
  ideas,
  getTimestamp,
  retentionDays,
  restoreLabel,
  onRestore,
}: {
  label: string;
  ideas: Idea[];
  getTimestamp: (idea: Idea) => string;
  retentionDays: number;
  restoreLabel: string;
  onRestore: (id: string) => void;
}) {
  return (
    <CollapsibleSection label={label} count={ideas.length}>
      {ideas.map((idea) => (
        <ShelvedRow
          key={idea.id}
          idea={idea}
          timestamp={getTimestamp(idea)}
          retentionDays={retentionDays}
          restoreLabel={restoreLabel}
          onRestore={() => onRestore(idea.id)}
        />
      ))}
    </CollapsibleSection>
  );
}

export function EnrichTable() {
  const ideas = useWorkspaceStore((s) => s.ideas);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const duplicatePairs = useWorkspaceStore((s) => s.duplicatePairs)();
  const aiJudgeError = useWorkspaceStore((s) => s.aiJudgeError);
  const dismissAiJudgeError = useWorkspaceStore((s) => s.dismissAiJudgeError);
  const setStageSubtitle = useWorkspaceStore((s) => s.setStageSubtitle);
  const restoreIdea = useWorkspaceStore((s) => s.restoreIdea);
  const reopenIdea = useWorkspaceStore((s) => s.reopenIdea);
  const [editAll, setEditAll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [sourceFilter, setSourceFilter] = useState<Set<Source>>(new Set());
  const [scoredFilter, setScoredFilter] = useState<ScoredFilter>("all");
  const [ranges, setRanges] = useState<Record<string, RangeFilter>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const columns = COLUMNS[workspace.activeFramework];

  const activeFilterCount =
    sourceFilter.size +
    (scoredFilter !== "all" ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0) +
    Object.values(ranges).filter((r) => r.min !== undefined || r.max !== undefined).length;

  const setRange = (key: string, range: RangeFilter) =>
    setRanges((cur) => ({ ...cur, [key]: range }));

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

  const list = useMemo(() => {
    let base = activeIdeas(ideas);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      base = base.filter((i) => i.title.toLowerCase().includes(q));
    }
    if (sourceFilter.size > 0) base = base.filter((i) => sourceFilter.has(i.source));
    if (scoredFilter !== "all") {
      const wantScored = scoredFilter === "scored";
      base = base.filter((i) => hasFieldInputs(i, workspace.activeFramework) === wantScored);
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

    const col = sortKey ? columns.find((c) => c.key === sortKey) : undefined;
    if (!col) return base;
    return [...base].sort((a, b) => {
      const av = col.getValue(a);
      const bv = col.getValue(b);
      if (av === undefined && bv === undefined) return 0;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [ideas, columns, sortKey, sortDir, sourceFilter, scoredFilter, ranges, searchQuery, workspace.activeFramework]);

  // Every active idea (i.e. not done or archived) lives under "In Planning" —
  // the main area above it is left for duplicate review, filters, and sorting only.
  const inPlanningList = list;

  const done = useMemo(
    () =>
      ideas
        .filter((i) => i.doneAt && !i.duplicateOf)
        .sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? "")),
    [ideas]
  );

  const archived = useMemo(
    () =>
      ideas
        .filter((i) => i.archivedAt && !i.duplicateOf)
        .sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? "")),
    [ideas]
  );

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const completion = enrichCompletion(ideas, workspace);

  useEffect(() => {
    const text = `${completion.total} ideas auto-scored from source data. Review before proceeding${
      duplicatePairs.length > 0
        ? ` · ${duplicatePairs.length} possible duplicate${duplicatePairs.length > 1 ? "s" : ""} to resolve`
        : ""
    }${activeFilterCount > 0 ? ` · showing ${list.length} of ${completion.total}` : ""}.`;
    setStageSubtitle(text);
  }, [completion.total, duplicatePairs.length, activeFilterCount, list.length, setStageSubtitle]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-2">
      <div className="flex items-center gap-3 text-sm text-text-muted">
        Choose your prioritization framework for planning
        <FrameworkSwitcher />
      </div>

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

      {duplicatePairs.length > 0 && (
        <div className="flex flex-col gap-2">
          {duplicatePairs.map(({ a, b }) => (
            <DuplicateCard key={`${a.id}-${b.id}`} a={a} b={b} />
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
        <HeaderRow
          framework={workspace.activeFramework}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
        />
      </div>

      {list.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
          No ideas match these filters.{" "}
          <button onClick={clearFilters} className="font-medium text-accent hover:underline">
            Clear filters
          </button>
        </p>
      )}

      <CollapsibleSection label="In Planning" count={inPlanningList.length} defaultOpen>
        {inPlanningList.map((idea) => (
          <EnrichRow
            key={idea.id}
            idea={idea}
            framework={workspace.activeFramework}
            editAll={editAll}
            editable={editAll || editingId === idea.id}
            onToggleEdit={() => setEditingId((cur) => (cur === idea.id ? null : idea.id))}
            searchQuery={searchQuery}
          />
        ))}
      </CollapsibleSection>

      <ShelvedSection
        label="Done"
        ideas={done}
        getTimestamp={(idea) => idea.doneAt!}
        retentionDays={DONE_RETENTION_DAYS}
        restoreLabel="Reopen"
        onRestore={reopenIdea}
      />
      <ShelvedSection
        label="Archived"
        ideas={archived}
        getTimestamp={(idea) => idea.archivedAt!}
        retentionDays={ARCHIVE_RETENTION_DAYS}
        restoreLabel="Restore"
        onRestore={restoreIdea}
      />
    </div>
  );
}
