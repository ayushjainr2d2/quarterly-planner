import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { seedIdeas } from "../data/seedIdeas";
import type { Comment, Framework, Idea, Scores, Stage, Status, Workspace } from "../types";
import {
  computeScore,
  effortScoreFromSprints,
  isIdeaScored,
  remapScoresForFramework,
} from "../lib/scoring";
import { computeSmartDefaults } from "../lib/smartDefaults";
import { purgeExpiredArchives } from "../lib/archive";
import { findDuplicatePairs } from "../lib/duplicateDetection";
import { autoAssignQuarters } from "../lib/plan";
import { fetchIdeasFromSheet, SheetSyncError } from "../lib/googleSheetSync";
import {
  judgeReach,
  judgeImpact,
  judgeConfidence,
  judgeValue,
  LlmJudgeError,
  type JudgeSuggestion,
  type PriorFieldNote,
} from "../lib/llmJudge";

function deriveStatus(idea: Idea, framework: Framework): Status {
  if (idea.status === "committed" || idea.status === "deprioritized") return idea.status;
  if (!isIdeaScored(idea, framework)) return "unscored";
  if (!idea.theme || !idea.owner) return "scored";
  return "organized";
}

function recalc(idea: Idea, framework: Framework): Idea {
  const computedScore = computeScore(idea, framework);
  return { ...idea, computedScore, status: deriveStatus({ ...idea, computedScore }, framework) };
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

/** Runs a judge prompt for one idea's field, tracking per-idea loading and a shared error banner. */
async function requestFieldSuggestion(
  set: (partial: Partial<WorkspaceState> | ((s: WorkspaceState) => Partial<WorkspaceState>)) => void,
  get: () => WorkspaceState,
  id: string,
  field: keyof AiSuggestions,
  judge: (idea: Idea) => Promise<JudgeSuggestion>
): Promise<void> {
  const idea = get().ideas.find((i) => i.id === id && !i.duplicateOf);
  if (!idea) return;

  const loadingKey = `${id}::${field}`;
  set((s) => ({ aiJudgeLoading: new Set(s.aiJudgeLoading).add(loadingKey), aiJudgeError: null }));
  try {
    const suggestion = await judge(idea);
    // Applies immediately — no confirmation gate. The field is still just a normal
    // editable score afterward (same as the regex-based smart defaults), and the
    // rationale sticks around as an informational note the PM can dismiss.
    set((s) => {
      const target = s.ideas.find((i) => i.id === id);
      if (!target) return {};
      const autoFilled = { ...target.autoFilled, [field]: true };
      const updated = recalc(
        { ...target, scores: { ...target.scores, [field]: suggestion.value }, autoFilled },
        s.workspace.activeFramework
      );
      return {
        ideas: s.ideas.map((i) => (i.id === id ? updated : i)),
        pendingAiSuggestions: {
          ...s.pendingAiSuggestions,
          [id]: { ...s.pendingAiSuggestions[id], [field]: suggestion },
        },
      };
    });
  } catch (err) {
    const message = err instanceof LlmJudgeError ? err.message : "AI suggestion failed — please try again.";
    set({ aiJudgeError: message });
  } finally {
    set((s) => {
      const next = new Set(s.aiJudgeLoading);
      next.delete(loadingKey);
      return { aiJudgeLoading: next };
    });
  }
}

/** Fills reach, then impact, then confidence for one idea — in that order, so the Confidence
 * judge can see the freshly-set reach/impact values as prior-field context. */
async function autoJudgeIdeaRice(get: () => WorkspaceState, id: string): Promise<void> {
  const findIdea = () => get().ideas.find((i) => i.id === id && !i.duplicateOf);
  if (!findIdea()) return;
  if (findIdea()!.scores.reach === undefined) await get().requestReachSuggestion(id);
  if (!findIdea()) return;
  if (findIdea()!.scores.impact === undefined) await get().requestImpactSuggestion(id);
  if (!findIdea()) return;
  if (findIdea()!.scores.confidence === undefined) await get().requestConfidenceSuggestion(id);
}

async function autoJudgeIdeaValueEffort(get: () => WorkspaceState, id: string): Promise<void> {
  const idea = get().ideas.find((i) => i.id === id && !i.duplicateOf);
  if (!idea || idea.scores.value !== undefined) return;
  await get().requestValueSuggestion(id);
}

let autoJudgeInFlight = false;

/** Auto-fills every field still missing for the active framework, a few ideas at a time —
 * run after every sheet sync so PMs never have to click "Suggest" manually. Each field
 * shows a loading spinner (via aiJudgeLoading) until it's populated. */
async function autoJudgeAllIdeas(get: () => WorkspaceState): Promise<void> {
  const framework = get().workspace.activeFramework;
  if (autoJudgeInFlight || (framework !== "RICE" && framework !== "value_effort")) return;
  autoJudgeInFlight = true;
  try {
    const targets = get().ideas.filter((i) => {
      if (i.duplicateOf || i.archivedAt || i.doneAt) return false;
      return framework === "RICE"
        ? i.scores.reach === undefined || i.scores.impact === undefined || i.scores.confidence === undefined
        : i.scores.value === undefined;
    });
    const autoJudgeIdea = framework === "RICE" ? autoJudgeIdeaRice : autoJudgeIdeaValueEffort;
    const concurrency = 3;
    let cursor = 0;
    async function worker() {
      while (cursor < targets.length) {
        const idea = targets[cursor++];
        await autoJudgeIdea(get, idea.id);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  } finally {
    autoJudgeInFlight = false;
  }
}

export interface SheetSyncState {
  status: "idle" | "syncing" | "error";
  lastSyncedAt: number | null;
  error: string | null;
}

/** AI-judge fields, keyed by idea id. */
export interface AiSuggestions {
  reach?: JudgeSuggestion;
  impact?: JudgeSuggestion;
  confidence?: JudgeSuggestion;
  value?: JudgeSuggestion;
}

interface WorkspaceState {
  ideas: Idea[];
  workspace: Workspace;
  stage: Stage;
  dismissedBanners: Record<Stage, boolean>;
  dismissedDuplicatePairs: Set<string>;
  pendingAiSuggestions: Record<string, AiSuggestions>;
  aiJudgeLoading: Set<string>;
  aiJudgeError: string | null;
  planGenerated: boolean;
  sheetSync: SheetSyncState;
  /** The active stage's dynamic subheading — rendered in the App-level header bar next
   * to the stage title, but each stage component computes its own text since it depends
   * on that stage's local filter/search/view state. */
  stageSubtitle: string;

  setStage: (stage: Stage) => void;
  dismissBanner: (stage: Stage) => void;
  rearmBanner: (stage: Stage) => void;
  setStageSubtitle: (text: string) => void;

  updateScores: (id: string, partial: Partial<Scores>) => void;
  setEffortSprints: (id: string, sprints: number) => void;
  setTitle: (id: string, title: string) => void;
  setDescription: (id: string, description: string) => void;
  setRawContext: (id: string, rawContext: string) => void;
  setTheme: (id: string, theme: string) => void;
  setOwner: (id: string, owner: string) => void;
  setPrdUrl: (id: string, prdUrl: string) => void;
  setStartDate: (id: string, startDate: string) => void;
  addComment: (id: string, text: string) => void;
  addManualIdea: (title: string, description: string) => void;
  archiveIdea: (id: string) => void;
  restoreIdea: (id: string) => void;
  markIdeaDone: (id: string) => void;
  reopenIdea: (id: string) => void;

  setFramework: (framework: Framework) => void;
  setCapacity: (sprints: number) => void;

  duplicatePairs: () => { a: Idea; b: Idea; similarity: number }[];
  dismissDuplicatePair: (aId: string, bId: string) => void;
  mergeIdeas: (aId: string, bId: string) => void;

  requestReachSuggestion: (id: string) => Promise<void>;
  requestImpactSuggestion: (id: string) => Promise<void>;
  requestConfidenceSuggestion: (id: string) => Promise<void>;
  requestValueSuggestion: (id: string) => Promise<void>;
  autoJudgeAllIdeas: () => Promise<void>;
  dismissAiSuggestion: (id: string, field: keyof AiSuggestions) => void;
  dismissAiJudgeError: () => void;

  setSelectionOverride: (id: string, override: boolean) => void;
  commitIdea: (id: string, quarterPosition: string) => void;
  deprioritizeIdea: (id: string) => void;
  setQuarterPosition: (id: string, quarterPosition: string) => void;
  autoGeneratePlan: () => void;
  syncFromSheet: () => Promise<void>;
}

const initialWorkspace: Workspace = {
  capacityPersonSprints: 40,
  activeFramework: "RICE",
};

function withSmartDefaults(ideas: Idea[]): Idea[] {
  return ideas.map((idea) => {
    const { scores, autoFilled } = computeSmartDefaults(idea);
    return {
      ...idea,
      scores: { ...idea.scores, ...scores },
      autoFilled: { ...idea.autoFilled, ...autoFilled },
    };
  });
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
  ideas: withSmartDefaults(seedIdeas).map((i) => recalc(i, initialWorkspace.activeFramework)),
  workspace: initialWorkspace,
  stage: "enrich",
  dismissedBanners: { enrich: false, discuss: false, plan: false },
  dismissedDuplicatePairs: new Set(),
  pendingAiSuggestions: {},
  aiJudgeLoading: new Set(),
  aiJudgeError: null,
  planGenerated: false,
  sheetSync: { status: "idle", lastSyncedAt: null, error: null },
  stageSubtitle: "",

  setStage: (stage) => set({ stage, stageSubtitle: "" }),
  dismissBanner: (stage) =>
    set((s) => ({ dismissedBanners: { ...s.dismissedBanners, [stage]: true } })),
  rearmBanner: (stage) =>
    set((s) => ({ dismissedBanners: { ...s.dismissedBanners, [stage]: false } })),
  setStageSubtitle: (text) => set({ stageSubtitle: text }),

  updateScores: (id, partial) =>
    set((s) => ({
      ideas: s.ideas.map((idea) => {
        if (idea.id !== id) return idea;
        const autoFilled = { ...idea.autoFilled };
        for (const key of Object.keys(partial)) {
          if (key === "reach" || key === "impact" || key === "value") {
            (autoFilled as Record<string, boolean>)[key] = false;
          }
        }
        return recalc(
          { ...idea, scores: { ...idea.scores, ...partial }, autoFilled },
          s.workspace.activeFramework
        );
      }),
    })),

  setEffortSprints: (id, sprints) =>
    get().updateScores(id, { effort: effortScoreFromSprints(sprints) }),

  setTitle: (id, title) =>
    set((s) => ({
      ideas: s.ideas.map((idea) => (idea.id === id ? { ...idea, title } : idea)),
    })),

  setDescription: (id, description) =>
    set((s) => ({
      ideas: s.ideas.map((idea) =>
        idea.id === id ? { ...idea, description, descriptionEdited: true } : idea
      ),
    })),

  setRawContext: (id, rawContext) =>
    set((s) => ({
      ideas: s.ideas.map((idea) => (idea.id === id ? { ...idea, rawContext, rawContextEdited: true } : idea)),
    })),

  setTheme: (id, theme) =>
    set((s) => ({
      ideas: s.ideas.map((idea) =>
        idea.id === id ? recalc({ ...idea, theme }, s.workspace.activeFramework) : idea
      ),
    })),

  setOwner: (id, owner) =>
    set((s) => ({
      ideas: s.ideas.map((idea) =>
        idea.id === id ? recalc({ ...idea, owner }, s.workspace.activeFramework) : idea
      ),
    })),

  setPrdUrl: (id, prdUrl) =>
    set((s) => ({
      ideas: s.ideas.map((idea) => (idea.id === id ? { ...idea, prdUrl } : idea)),
    })),

  setStartDate: (id, startDate) =>
    set((s) => ({
      ideas: s.ideas.map((idea) => (idea.id === id ? { ...idea, startDate } : idea)),
    })),

  addComment: (id, text) =>
    set((s) => {
      const comment: Comment = { id: crypto.randomUUID(), text, createdAt: Date.now() };
      return {
        ideas: s.ideas.map((idea) =>
          idea.id === id ? { ...idea, comments: [...(idea.comments ?? []), comment] } : idea
        ),
      };
    }),

  addManualIdea: (title, description) =>
    set((s) => {
      const idea: Idea = recalc(
        {
          id: crypto.randomUUID(),
          title,
          description,
          source: "manual",
          // No ingestion pipeline for a manually-added feature — the description doubles as
          // its raw context so the AI judge still has something to reason from.
          rawContext: description,
          scores: {},
          autoFilled: {},
          computedScore: 0,
          theme: "",
          owner: "",
          status: "unscored",
        },
        s.workspace.activeFramework
      );
      return { ideas: [idea, ...s.ideas] };
    }),

  archiveIdea: (id) =>
    set((s) => ({
      ideas: s.ideas.map((idea) =>
        idea.id === id ? { ...idea, archivedAt: new Date().toISOString(), doneAt: undefined } : idea
      ),
    })),

  restoreIdea: (id) =>
    set((s) => ({
      ideas: s.ideas.map((idea) => {
        if (idea.id !== id) return idea;
        const { archivedAt: _archivedAt, ...rest } = idea;
        return rest;
      }),
    })),

  markIdeaDone: (id) =>
    set((s) => ({
      ideas: s.ideas.map((idea) =>
        idea.id === id ? { ...idea, doneAt: new Date().toISOString(), archivedAt: undefined } : idea
      ),
    })),

  reopenIdea: (id) =>
    set((s) => ({
      ideas: s.ideas.map((idea) => {
        if (idea.id !== id) return idea;
        const { doneAt: _doneAt, ...rest } = idea;
        return rest;
      }),
    })),

  setFramework: (framework) =>
    set((s) => ({
      workspace: { ...s.workspace, activeFramework: framework },
      ideas: s.ideas.map((idea) =>
        recalc({ ...idea, scores: remapScoresForFramework(idea, framework) }, framework)
      ),
    })),

  setCapacity: (sprints) =>
    set((s) => ({ workspace: { ...s.workspace, capacityPersonSprints: sprints } })),

  duplicatePairs: () => {
    const s = get();
    const active = s.ideas.filter((i) => !i.duplicateOf && !i.archivedAt && !i.doneAt);
    return findDuplicatePairs(active)
      .filter((p) => !s.dismissedDuplicatePairs.has(pairKey(p.a, p.b)))
      .map((p) => ({
        a: active.find((i) => i.id === p.a)!,
        b: active.find((i) => i.id === p.b)!,
        similarity: p.similarity,
      }));
  },

  dismissDuplicatePair: (aId, bId) =>
    set((s) => ({
      dismissedDuplicatePairs: new Set(s.dismissedDuplicatePairs).add(pairKey(aId, bId)),
    })),

  mergeIdeas: (aId, bId) =>
    set((s) => {
      const a = s.ideas.find((i) => i.id === aId)!;
      const b = s.ideas.find((i) => i.id === bId)!;
      const [keep, drop] = a.computedScore >= b.computedScore ? [a, b] : [b, a];
      const mergedSources = Array.from(new Set([...(keep.mergedSources ?? [keep.source]), drop.source]));

      const dropContext = drop.rawContext.trim();
      const rawContext = dropContext
        ? [keep.rawContext.trim(), `From ${drop.source} ("${drop.title}"): ${dropContext}`]
            .filter(Boolean)
            .join("\n\n")
        : keep.rawContext;

      return {
        ideas: s.ideas.map((idea) => {
          if (idea.id === keep.id) {
            const merged = { ...idea, mergedSources, rawContext };
            // Re-run smart defaults now that the merged context may carry signals
            // (ticket counts, deal size) the surviving idea didn't have alone.
            const { scores, autoFilled } = computeSmartDefaults(merged);
            return recalc(
              { ...merged, scores: { ...merged.scores, ...scores }, autoFilled: { ...merged.autoFilled, ...autoFilled } },
              s.workspace.activeFramework
            );
          }
          if (idea.id === drop.id) return { ...idea, duplicateOf: keep.id };
          return idea;
        }),
      };
    }),

  requestReachSuggestion: (id) => requestFieldSuggestion(set, get, id, "reach", judgeReach),

  requestImpactSuggestion: (id) => requestFieldSuggestion(set, get, id, "impact", judgeImpact),

  requestConfidenceSuggestion: (id) => {
    const idea = get().ideas.find((i) => i.id === id);
    const pending = get().pendingAiSuggestions[id];
    const reachNote: PriorFieldNote | undefined =
      pending?.reach ?? (idea?.scores.reach !== undefined ? { value: idea.scores.reach } : undefined);
    const impactNote: PriorFieldNote | undefined =
      pending?.impact ?? (idea?.scores.impact !== undefined ? { value: idea.scores.impact } : undefined);
    return requestFieldSuggestion(set, get, id, "confidence", (i) => judgeConfidence(i, reachNote, impactNote));
  },

  requestValueSuggestion: (id) => requestFieldSuggestion(set, get, id, "value", judgeValue),

  autoJudgeAllIdeas: () => autoJudgeAllIdeas(get),

  dismissAiSuggestion: (id, field) =>
    set((s) => {
      const pendingAiSuggestions = { ...s.pendingAiSuggestions };
      const remaining = { ...pendingAiSuggestions[id] };
      delete remaining[field];
      if (Object.keys(remaining).length === 0) delete pendingAiSuggestions[id];
      else pendingAiSuggestions[id] = remaining;
      return { pendingAiSuggestions };
    }),

  dismissAiJudgeError: () => set({ aiJudgeError: null }),

  setSelectionOverride: (id, override) =>
    set((s) => ({
      ideas: s.ideas.map((idea) => (idea.id === id ? { ...idea, selectionOverride: override } : idea)),
    })),

  commitIdea: (id, quarterPosition) =>
    set((s) => ({
      ideas: s.ideas.map((idea) =>
        idea.id === id ? { ...idea, status: "committed", quarterPosition } : idea
      ),
    })),

  deprioritizeIdea: (id) =>
    set((s) => ({
      ideas: s.ideas.map((idea) =>
        idea.id === id ? { ...idea, status: "deprioritized", quarterPosition: undefined } : idea
      ),
    })),

  setQuarterPosition: (id, quarterPosition) =>
    set((s) => ({
      ideas: s.ideas.map((idea) => (idea.id === id ? { ...idea, quarterPosition } : idea)),
    })),

  autoGeneratePlan: () =>
    set((s) => {
      if (s.planGenerated) return s;
      const active = s.ideas.filter((i) => !i.duplicateOf && !i.archivedAt && !i.doneAt);
      const { committed, deprioritizedIds } = autoAssignQuarters(
        active,
        s.workspace.activeFramework,
        s.workspace.capacityPersonSprints
      );
      const deprioritizedSet = new Set(deprioritizedIds);
      return {
        planGenerated: true,
        ideas: s.ideas.map((idea) => {
          if (committed[idea.id]) {
            return { ...idea, status: "committed" as const, quarterPosition: committed[idea.id] };
          }
          if (deprioritizedSet.has(idea.id)) {
            return { ...idea, status: "deprioritized" as const };
          }
          return idea;
        }),
      };
    }),

  syncFromSheet: async () => {
    set((s) => ({ sheetSync: { ...s.sheetSync, status: "syncing", error: null } }));
    try {
      const rows = await fetchIdeasFromSheet();
      set((s) => {
        const existingById = new Map(s.ideas.map((i) => [i.id, i]));
        const framework = s.workspace.activeFramework;
        const seenIds = new Set<string>();

        const synced = rows.map((row) => {
          seenIds.add(row.id);
          const existing = existingById.get(row.id);
          const base: Idea = existing
            ? {
                ...existing,
                title: row.title,
                description: existing.descriptionEdited ? existing.description : row.description,
                source: row.source,
                rawContext: existing.rawContextEdited ? existing.rawContext : row.rawContext,
                theme: row.theme || existing.theme,
                owner: row.owner || existing.owner,
              }
            : {
                id: row.id,
                title: row.title,
                description: row.description,
                source: row.source,
                rawContext: row.rawContext,
                theme: row.theme,
                owner: row.owner,
                scores: {},
                autoFilled: {},
                computedScore: 0,
                status: "unscored",
              };
          const { scores, autoFilled } = computeSmartDefaults(base);
          return recalc(
            { ...base, scores: { ...base.scores, ...scores }, autoFilled: { ...base.autoFilled, ...autoFilled } },
            framework
          );
        });

        // Ideas removed from the sheet are kept, not deleted — PM work on them is never silently lost.
        const untouched = s.ideas.filter((i) => !seenIds.has(i.id));

        return {
          // Runs on every sync (on load + each 60s poll) so archives past the retention
          // window get swept even if the PM never revisits the Enrich page.
          ideas: purgeExpiredArchives([...synced, ...untouched]),
          sheetSync: { status: "idle", lastSyncedAt: Date.now(), error: null },
        };
      });
      void get().autoJudgeAllIdeas();
    } catch (err) {
      const message = err instanceof SheetSyncError ? err.message : "Sync failed — please try again.";
      set((s) => ({ sheetSync: { status: "error", lastSyncedAt: s.sheetSync.lastSyncedAt, error: message } }));
    }
  },
    }),
    {
      // Persists across reloads so already-scored ideas never re-trigger the AI judge on
      // page load — only genuinely new (unscored) fields or an explicit Rescore do.
      name: "quarterly-planner-workspace",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        ideas: s.ideas,
        workspace: s.workspace,
        stage: s.stage,
        dismissedBanners: s.dismissedBanners,
        pendingAiSuggestions: s.pendingAiSuggestions,
        planGenerated: s.planGenerated,
      }),
    }
  )
);
