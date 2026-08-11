import type { Idea } from "../types";

const STOPWORDS = new Set([
  "a", "an", "the", "for", "to", "of", "and", "or", "in", "on", "so", "so",
  "is", "are", "want", "with", "via", "their", "own", "so", "let", "can",
  "when", "so", "instead", "into", "this", "that", "it", "as", "be", "have",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return intersection / union;
}

export interface DuplicatePair {
  a: string;
  b: string;
  similarity: number;
}

const SIMILARITY_THRESHOLD = 0.18;

/** Deterministic title+description token-overlap similarity — no ML dependency. */
export function findDuplicatePairs(ideas: Idea[]): DuplicatePair[] {
  const tokenSets = ideas.map((idea) => tokenize(`${idea.title} ${idea.description}`));
  const pairs: DuplicatePair[] = [];

  for (let i = 0; i < ideas.length; i++) {
    if (ideas[i].dismissedDuplicate || ideas[i].duplicateOf) continue;
    for (let j = i + 1; j < ideas.length; j++) {
      if (ideas[j].dismissedDuplicate || ideas[j].duplicateOf) continue;
      const similarity = jaccard(tokenSets[i], tokenSets[j]);
      if (similarity >= SIMILARITY_THRESHOLD) {
        pairs.push({ a: ideas[i].id, b: ideas[j].id, similarity });
      }
    }
  }

  return pairs.sort((x, y) => y.similarity - x.similarity);
}
