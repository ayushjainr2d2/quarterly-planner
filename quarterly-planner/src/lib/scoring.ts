import type { Framework, Idea, Scores } from "../types";

/** Effort score per PRD §8: 0.5 sprint -> 1, 1 sprint -> 2, 1.5 sprints -> 3, etc. */
export function effortScoreFromSprints(sprints: number): number {
  return sprints * 2;
}

export function sprintsFromEffortScore(effortScore: number): number {
  return effortScore / 2;
}

/** Whether the framework-specific rating fields are filled — independent of effort,
 * which is captured later (Discuss stage, needs engineering input). */
export function hasFieldInputs(idea: Idea, framework: Framework): boolean {
  const s = idea.scores;
  switch (framework) {
    case "RICE":
      return s.reach !== undefined && s.impact !== undefined && s.confidence !== undefined;
    case "value_effort":
      return s.value !== undefined;
  }
}

/** Whether the idea is fully scored — rating fields plus effort, i.e. has a real computed_score. */
export function isIdeaScored(idea: Idea, framework: Framework): boolean {
  const s = idea.scores;
  if (s.effort === undefined || s.effort <= 0) return false;
  return hasFieldInputs(idea, framework);
}

export function computeScore(idea: Idea, framework: Framework): number {
  if (!isIdeaScored(idea, framework)) return 0;
  const s = idea.scores;
  // computeScore divides by real sprints (not the doubled effort_score) so the
  // RICE/Value-Effort numbers match the textbook formula a PM would expect.
  const effortSprints = sprintsFromEffortScore(s.effort!);

  switch (framework) {
    case "RICE":
      return (s.reach! * s.impact! * (s.confidence! / 100)) / effortSprints;
    case "value_effort":
      return s.value! / effortSprints;
  }
}

/** The bare formula for the active framework, with no idea-specific numbers — for
 * the Score column HEADER tooltip, where there's no single row to plug values from. */
export function scoreFormulaLabel(framework: Framework): string {
  return framework === "RICE"
    ? "Score = (Reach × Impact × Confidence) ÷ Effort"
    : "Score = Value ÷ Effort";
}

/** Plain-language breakdown of how a score was (or would be) calculated, for a
 * tooltip on the Score column — states the formula for the active framework, and
 * plugs in the idea's actual numbers once it's fully scored. */
export function scoreExplanation(idea: Idea, framework: Framework): string {
  const s = idea.scores;

  const formula = scoreFormulaLabel(framework);

  if (!isIdeaScored(idea, framework)) {
    const missing =
      framework === "RICE"
        ? ["reach", "impact", "confidence", "effort"].filter((k) => s[k as keyof Scores] === undefined)
        : ["value", "effort"].filter((k) => s[k as keyof Scores] === undefined);
    return `${formula}\nStill needs: ${missing.join(", ") || "effort"}.`;
  }

  const effortSprints = sprintsFromEffortScore(s.effort!);
  const score = computeScore(idea, framework);

  if (framework === "RICE") {
    return `${formula}\n= (${s.reach} × ${s.impact} × ${s.confidence}%) ÷ ${effortSprints}sp\n= ${score.toFixed(2)}`;
  }
  return `${formula}\n= ${s.value} ÷ ${effortSprints}sp\n= ${score.toFixed(2)}`;
}

/**
 * Remap scores when switching frameworks so compatible fields carry over
 * instead of resetting (RICE Impact <-> Value, effort always carried as-is).
 */
/**
 * Never deletes a field — only fills in the target framework's fields from a
 * compatible source field when they're still empty, so switching back and
 * forth never loses previously entered data.
 */
export function remapScoresForFramework(idea: Idea, target: Framework): Idea["scores"] {
  const s = idea.scores;
  const next: Idea["scores"] = { ...s };

  if (target === "RICE" && next.impact === undefined) {
    next.impact = s.value;
  } else if (target === "value_effort" && next.value === undefined) {
    next.value = s.impact;
  }

  return next;
}

export interface CapacityResult {
  /** ids that fall at/above the cutoff (within capacity) */
  withinCapacity: Set<string>;
  cumulativeEffortSprints: number;
  cutoffIndex: number; // index in the sorted array where the line falls
  /** the array in priority (computed_score desc) order the cutoff was computed against */
  sorted: Idea[];
}

/**
 * Sorts by computed_score desc and walks cumulative effort against capacity —
 * this is the automatic "what fits" baseline; PMs can still override individual
 * ideas in/out of the selected set via Idea.selectionOverride.
 */
export function computeCapacityCutoff(
  ideas: Idea[],
  capacityPersonSprints: number
): CapacityResult {
  const sorted = [...ideas].sort((a, b) => b.computedScore - a.computedScore);

  const withinCapacity = new Set<string>();
  let cumulative = 0;
  let cutoffIndex = sorted.length;

  for (let i = 0; i < sorted.length; i++) {
    if (cutoffIndex !== sorted.length) break; // line already crossed — everything after is below it
    const sprints = sprintsFromEffortScore(sorted[i].scores.effort ?? 0);
    if (cumulative + sprints <= capacityPersonSprints) {
      cumulative += sprints;
      withinCapacity.add(sorted[i].id);
    } else {
      cutoffIndex = i;
    }
  }

  return { withinCapacity, cumulativeEffortSprints: cumulative, cutoffIndex, sorted };
}

export interface SelectionResult {
  /** Auto-selected (within capacity, score-priority order) ∪ overridden-in − overridden-out. */
  isSelected: (idea: Idea) => boolean;
  selectedIdeas: Idea[];
  totalEffortSprints: number;
}

/**
 * The one selection computation used everywhere a "what's actually committed"
 * total is needed (Discuss rows, the header capacity indicator). Always run
 * against the FULL active idea set — never a filtered/search-narrowed view —
 * so the auto-cutoff ranking and the total stay correct regardless of what's
 * currently visible on screen. An idea with no real score (missing effort
 * included) has no priority to rank by, so it defaults to unselected unless
 * a PM explicitly overrides it in.
 */
export function computeSelection(
  ideas: Idea[],
  framework: Framework,
  capacityPersonSprints: number
): SelectionResult {
  const { withinCapacity: autoSelected } = computeCapacityCutoff(ideas, capacityPersonSprints);
  const isSelected = (idea: Idea) =>
    idea.selectionOverride ?? (isIdeaScored(idea, framework) && autoSelected.has(idea.id));
  const selectedIdeas = ideas.filter(isSelected);
  const totalEffortSprints = selectedIdeas.reduce((sum, i) => sum + sprintsFromEffortScore(i.scores.effort ?? 0), 0);
  return { isSelected, selectedIdeas, totalEffortSprints };
}

export type Quadrant = "Quick Win" | "Major Project" | "Fill-in" | "Thankless Task";

export function valueEffortQuadrant(value: number, effortSprints: number): Quadrant {
  const highValue = value >= 3;
  const lowEffort = effortSprints <= 2;
  if (highValue && lowEffort) return "Quick Win";
  if (highValue && !lowEffort) return "Major Project";
  if (!highValue && lowEffort) return "Fill-in";
  return "Thankless Task";
}
