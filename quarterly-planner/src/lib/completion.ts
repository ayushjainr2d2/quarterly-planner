import type { Idea, Stage, Workspace } from "../types";
import { hasFieldInputs } from "./scoring";

export function activeIdeas(ideas: Idea[]): Idea[] {
  return ideas.filter((i) => !i.duplicateOf && !i.archivedAt && !i.doneAt);
}

export interface StageCompletion {
  done: number;
  total: number;
}

export function enrichCompletion(ideas: Idea[], workspace: Workspace): StageCompletion {
  const active = activeIdeas(ideas);
  return {
    done: active.filter((i) => hasFieldInputs(i, workspace.activeFramework)).length,
    total: active.length,
  };
}

export function planCompletion(ideas: Idea[]): StageCompletion {
  const active = activeIdeas(ideas);
  return {
    done: active.filter((i) => i.status === "committed" || i.status === "deprioritized").length,
    total: active.length,
  };
}

export function stageCompletion(stage: Stage, ideas: Idea[], workspace: Workspace): StageCompletion {
  switch (stage) {
    case "enrich":
      return enrichCompletion(ideas, workspace);
    case "discuss":
      // No completion metric for Discuss — it's a free-form sanity-check pass, not a checklist.
      return { done: 0, total: 0 };
    case "plan":
      return planCompletion(ideas);
  }
}
