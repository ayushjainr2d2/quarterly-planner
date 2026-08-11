import type { Idea } from "../types";

export class LlmJudgeError extends Error {}

interface CallJudgeOptions {
  systemPrompt: string;
  userPrompt: string;
  jsonMode?: boolean;
  model?: string;
}

/** Calls our own /api/llm-judge proxy — the OpenAI key never reaches the browser. */
async function callLlmJudge({ systemPrompt, userPrompt, jsonMode, model }: CallJudgeOptions): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/llm-judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemPrompt, userPrompt, jsonMode, model }),
    });
  } catch {
    throw new LlmJudgeError("Couldn't reach the AI judge endpoint — is `npm run dev:api` running?");
  }

  const body = await res.json().catch(() => ({}) as { error?: string; content?: string });
  if (!res.ok) {
    throw new LlmJudgeError(body.error ?? `AI judge request failed (${res.status}).`);
  }
  return body.content ?? "";
}

/** Best-effort structured extraction from raw_context, passed alongside the free text itself
 * so a judge prompt can use whichever signals it needs without re-parsing. */
function extractRawSignals(idea: Idea): Record<string, unknown> {
  const text = idea.rawContext;
  const ticketMatch = text.match(/(\d+)\s+tickets?/i);
  const dealMatch = text.match(/\$\s?(\d+(?:\.\d+)?)\s?k/i);

  const signals: Record<string, unknown> = {};
  if (ticketMatch) signals.ticket_count = Number(ticketMatch[1]);
  if (dealMatch) signals.deal_value_usd = Number(dealMatch[1]) * 1000;
  if (/enterprise/i.test(text)) signals.requesting_customer_tier = "enterprise";
  if (/churn/i.test(text)) signals.churn_risk_mentioned = true;
  if (idea.source === "exec" || /\b(CEO|CFO|CTO|VP|Chief|Director)\b/.test(text)) signals.exec_mention = true;
  return signals;
}

export interface JudgeSuggestion {
  value: number;
  rationale: string;
  /** Not every judge reports its own confidence (the Confidence judge itself doesn't). */
  confidence?: "high" | "low";
}

interface JudgeResponse {
  idea_id?: string;
  rationale?: string;
  confidence?: "high" | "low";
  [scoreKey: string]: unknown;
}

/** Shared call+parse+validate for any judge prompt that returns `{ [scoreKey]: number, rationale, confidence? }`. */
async function callAndValidate(
  systemPrompt: string,
  userPrompt: string,
  scoreKey: string,
  isValidValue: (v: number) => boolean
): Promise<JudgeSuggestion> {
  const content = await callLlmJudge({ systemPrompt, userPrompt, jsonMode: true });

  let parsed: JudgeResponse;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new LlmJudgeError("The model didn't return valid JSON.");
  }

  const value = parsed[scoreKey];
  if (typeof value !== "number" || !isValidValue(value) || typeof parsed.rationale !== "string") {
    throw new LlmJudgeError("The model's response didn't match the expected shape.");
  }

  return {
    value,
    rationale: parsed.rationale,
    confidence: parsed.confidence === "high" || parsed.confidence === "low" ? parsed.confidence : undefined,
  };
}

const isOneToFive = (v: number) => Number.isInteger(v) && v >= 1 && v <= 5;

/** Standard request shape shared by the Reach/Impact judges: raw signals + free-text context. */
function signalUserPrompt(idea: Idea): string {
  return JSON.stringify({
    idea_id: idea.id,
    source: idea.source,
    raw_signals: extractRawSignals(idea),
    context_text: idea.rawContext || null,
  });
}

const REACH_SYSTEM_PROMPT = `You convert raw signals into a Reach score (1–5) for RICE prioritization. Reach measures breadth — how many distinct users or accounts this idea would affect — not how much it helps them (that's Impact).

For each idea, you'll receive:
- source: slack | jira | support | sales | exec | other
- raw_signals: ticket_count, requesting_customer_tier, request_frequency, deal_count, mentions_count (whatever exists)

Scoring rubric (anchors, use judgment between values):

Reach 5 — Affects nearly the entire user base or a core, universally-used flow.
  e.g. ticket_count > 100 spread across many accounts, OR affects a default/onboarding flow

Reach 4 — Affects a large, identifiable segment.
  e.g. ticket_count 30–100, OR requested by 10+ distinct accounts

Reach 3 — Affects a moderate, specific segment.
  e.g. ticket_count 10–30, OR requested by 3–10 distinct accounts

Reach 2 — Affects a small segment.
  e.g. ticket_count 3–10, OR 1–2 accounts, but those accounts are large/enterprise

Reach 1 — Affects very few users or a single account.
  e.g. ticket_count < 3, one-off request, no breadth signal

Rules:
- Distinguish breadth from size: one enterprise account is narrow reach even if high-value (that belongs in Impact, not here).
- Count distinct requesters/accounts where available, not raw mention volume — 20 mentions from 2 accounts is narrow reach, not broad.
- If raw_signals is sparse, score conservatively (2 or lower) and state what's missing.

Return per idea:
{
  "idea_id": "...",
  "suggested_reach": <1-5>,
  "rationale": "<one sentence, cite the specific signal(s) used>",
  "confidence": "high" | "low"
}

Respond with that JSON object only — no surrounding text.`;

export async function judgeReach(idea: Idea): Promise<JudgeSuggestion> {
  return callAndValidate(REACH_SYSTEM_PROMPT, signalUserPrompt(idea), "suggested_reach", isOneToFive);
}

const IMPACT_SYSTEM_PROMPT = `You convert raw signals into an Impact score (1–5) for RICE prioritization. Sources are inconsistent — a ticket count means something different from a sales dollar figure — so normalize onto one comparable scale, don't average them.

For each idea: source (slack | jira | support | sales | exec | other), raw_signals (ticket_count, request_frequency, deal_value_usd, requesting_customer_tier, exec_mention — whatever exists).

Scoring rubric (anchors):

Impact 5 — Would meaningfully move a core metric or unblock significant revenue.
  e.g. deal_value_usd > $250k, OR ticket_count > 100, OR 3+ enterprise accounts requesting

Impact 4 — Clear, broad benefit but not existential.
  e.g. deal_value_usd $50k–250k, OR ticket_count 30–100, OR recurring weekly request

Impact 3 — Moderate, affects a meaningful subset.
  e.g. deal_value_usd $10k–50k, OR ticket_count 10–30, OR one enterprise account, recurring

Impact 2 — Narrow benefit.
  e.g. deal_value_usd < $10k, OR ticket_count 3–10, OR single non-recurring request

Impact 1 — Minimal, edge case, or insufficient signal.
  e.g. ticket_count < 3, one-off mention, no data at all

Rules:
- If signals conflict (high ticket_count, low deal_value), score toward the stronger signal and flag the conflict — don't average it away silently.
- Sparse data → score conservatively (2 or lower), state what's missing.
- Never invent numbers not present in raw_signals.

Return per idea:
{
  "idea_id": "...",
  "suggested_impact": <1-5>,
  "rationale": "<one sentence, cite the specific signal(s) used>",
  "confidence": "high" | "low"
}

Respond with that JSON object only — no surrounding text.`;

export async function judgeImpact(idea: Idea): Promise<JudgeSuggestion> {
  return callAndValidate(IMPACT_SYSTEM_PROMPT, signalUserPrompt(idea), "suggested_impact", isOneToFive);
}

const VALUE_SYSTEM_PROMPT = `You convert raw signals into a Value score (1–5) for Value vs. Effort prioritization. Value is a single composite measure of how worthwhile this idea is to build — how many users/accounts it affects AND how much it helps them — combined into one judgment call (there's no separate Reach/Impact split in this framework).

For each idea, you'll receive:
- source: slack | jira | support | sales | exec | other
- raw_signals: ticket_count, requesting_customer_tier, request_frequency, deal_value_usd, churn_risk_mentioned, exec_mention (whatever exists)
- context_text: free-text context

Scoring rubric (anchors, use judgment between values):

Value 5 — High breadth AND high stakes: affects a large/critical segment or unlocks major revenue.
  e.g. ticket_count > 100, OR deal_value_usd > $250k, OR churn risk on multiple enterprise accounts

Value 4 — Clear, broad benefit or a significant single stake.
  e.g. ticket_count 30–100, OR deal_value_usd $50k–250k, OR one enterprise account with churn risk

Value 3 — Moderate breadth or moderate stakes.
  e.g. ticket_count 10–30, OR deal_value_usd $10k–50k, OR recurring request without hard numbers

Value 2 — Narrow breadth and modest stakes.
  e.g. ticket_count 3–10, OR deal_value_usd < $10k, OR a single non-recurring request

Value 1 — Minimal breadth, minimal stakes, or insufficient signal.
  e.g. ticket_count < 3, one-off mention, no data at all

Rules:
- Combine breadth and stakes into one judgment — don't just average two sub-scores mechanically; let the stronger signal carry more weight when they diverge (e.g. one high-value enterprise churn risk can outweigh modest ticket volume).
- Sparse data → score conservatively (2 or lower), state what's missing.
- Never invent numbers not present in raw_signals.

Return per idea:
{
  "idea_id": "...",
  "suggested_value": <1-5>,
  "rationale": "<one sentence, cite the specific signal(s) used>",
  "confidence": "high" | "low"
}

Respond with that JSON object only — no surrounding text.`;

export async function judgeValue(idea: Idea): Promise<JudgeSuggestion> {
  return callAndValidate(VALUE_SYSTEM_PROMPT, signalUserPrompt(idea), "suggested_value", isOneToFive);
}

const CONFIDENCE_SYSTEM_PROMPT = `You assign a Confidence score (as a percentage: 100%, 80%, 50%, or 20%) for RICE prioritization. Confidence measures how much evidence backs the Reach and Impact estimates for this idea — NOT how good or important the idea is.

For each idea, you'll receive:
- source: slack | jira | support | sales | exec | other
- raw_signals: whatever data exists
- suggested_reach, suggested_impact: the scores already produced for this idea
- reach_confidence_note, impact_confidence_note: the "confidence: high/low" flags and rationale from those prior steps, if available

Scoring rubric (RICE's standard confidence bands — use these exactly, don't invent intermediate values):

100% — High confidence. Estimate is backed by hard data: exact counts, verified deal values, direct measurement.
  e.g. ticket_count is an exact system count, deal_value_usd is a closed/verified figure

80% — Medium confidence. Some real data, but with gaps or assumptions.
  e.g. ticket_count exists but source coverage is partial, deal is in pipeline not closed, frequency is estimated from a sample

50% — Low confidence. Mostly qualitative or anecdotal signal, a few data points extrapolated.
  e.g. a handful of mentions generalized into a broader claim, single-source anecdote treated as pattern

20% — Guess. Little to no real signal behind the estimate; scored mostly on gut feel or absence of data.
  e.g. raw_signals was empty or near-empty, Reach/Impact confidence was already flagged "low"

Rules:
- If the Reach or Impact step already flagged confidence as "low," this idea cannot score above 50% here — inherit the weaker link, don't average it away.
- Don't let idea importance influence this score. A guaranteed-important idea with weak data is still low confidence; a minor idea with hard data is still high confidence.
- If raw_signals is contradictory (e.g. two sources disagree on frequency), cap at 50% and note the contradiction.

Return per idea:
{
  "idea_id": "...",
  "suggested_confidence": 100 | 80 | 50 | 20,
  "rationale": "<one sentence: what evidence exists or is missing>"
}

Respond with that JSON object only — no surrounding text.`;

/** What the Reach/Impact judges produced for this idea, if that step has been run. */
export interface PriorFieldNote {
  value?: number;
  confidence?: "high" | "low";
  rationale?: string;
}

export async function judgeConfidence(
  idea: Idea,
  reachNote: PriorFieldNote | undefined,
  impactNote: PriorFieldNote | undefined
): Promise<JudgeSuggestion> {
  const userPrompt = JSON.stringify({
    idea_id: idea.id,
    source: idea.source,
    raw_signals: extractRawSignals(idea),
    context_text: idea.rawContext || null,
    suggested_reach: reachNote?.value ?? null,
    suggested_impact: impactNote?.value ?? null,
    reach_confidence_note: reachNote
      ? { confidence: reachNote.confidence ?? null, rationale: reachNote.rationale ?? null }
      : null,
    impact_confidence_note: impactNote
      ? { confidence: impactNote.confidence ?? null, rationale: impactNote.rationale ?? null }
      : null,
  });

  return callAndValidate(CONFIDENCE_SYSTEM_PROMPT, userPrompt, "suggested_confidence", (v) =>
    [100, 80, 50, 20].includes(v)
  );
}
