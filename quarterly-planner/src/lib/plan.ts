import type { Framework, Idea } from "../types";
import { computeSelection, sprintsFromEffortScore } from "./scoring";

export const MONTHS = ["Month 1", "Month 2", "Month 3"] as const;

export interface PlanAssignment {
  committed: Record<string, string>; // idea id -> quarter position
  deprioritizedIds: string[];
}

/**
 * Smart default for the Plan stage: ideas selected in Discuss (auto capacity-cutoff,
 * with any manual select/unselect overrides applied) are split across the 3 months
 * by cumulative effort; everything not selected is proposed for deprioritization.
 * Purely a starting point — the PM drags items between months/out afterward.
 */
export function autoAssignQuarters(
  ideas: Idea[],
  framework: Framework,
  capacityPersonSprints: number
): PlanAssignment {
  const { isSelected, selectedIdeas } = computeSelection(ideas, framework, capacityPersonSprints);
  const within = [...selectedIdeas].sort((a, b) => b.computedScore - a.computedScore);
  const totalEffort = within.reduce((sum, i) => sum + sprintsFromEffortScore(i.scores.effort ?? 0), 0);
  const perMonth = totalEffort / 3 || 1;

  const committed: Record<string, string> = {};
  let cumulative = 0;
  for (const idea of within) {
    const monthIndex = Math.min(2, Math.floor(cumulative / perMonth));
    committed[idea.id] = MONTHS[monthIndex];
    cumulative += sprintsFromEffortScore(idea.scores.effort ?? 0);
  }

  const deprioritizedIds = ideas.filter((i) => !isSelected(i)).map((i) => i.id);
  return { committed, deprioritizedIds };
}
