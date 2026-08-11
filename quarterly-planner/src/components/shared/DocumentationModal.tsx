import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookIcon } from "./icons";

interface Section {
  id: string;
  label: string;
}

const SECTIONS: Section[] = [
  { id: "getting-started", label: "1. Getting Started" },
  { id: "three-stages", label: "2. The Three Stages" },
  { id: "scoring-reference", label: "3. RICE & Value/Effort Scoring" },
  { id: "navigation-ui", label: "4. Navigation & UI" },
];

function DocSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4">
      <h3 className="font-serif text-base font-medium text-text">{title}</h3>
      <div className="mt-2 flex flex-col gap-3 text-sm text-text-secondary">{children}</div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs font-semibold tracking-wide text-text-muted uppercase">{children}</p>;
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <code className="block w-fit rounded-md bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-accent">
      {children}
    </code>
  );
}

function PromptDetails({ title, prompt }: { title: string; prompt: string }) {
  return (
    <details className="rounded-md border border-border bg-surface-2 px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-accent">{title} — full system prompt</summary>
      <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md bg-bg p-2.5 font-mono text-[11px] leading-relaxed text-text-secondary">
        {prompt}
      </pre>
    </details>
  );
}

const REACH_PROMPT = `You convert raw signals into a Reach score (1–5) for RICE prioritization. Reach measures breadth — how many distinct users or accounts this idea would affect — not how much it helps them (that's Impact).

For each idea, you'll receive:
- source: slack | jira | support | sales | exec | other
- raw_signals: ticket_count, requesting_customer_tier, request_frequency, deal_count, mentions_count (whatever exists)

Scoring rubric (anchors, use judgment between values):

Reach 5 — Affects nearly the entire user base or a core, universally-used flow.
Reach 4 — Affects a large, identifiable segment.
Reach 3 — Affects a moderate, specific segment.
Reach 2 — Affects a small segment (e.g. 1–2 accounts, but large/enterprise).
Reach 1 — Affects very few users or a single account.

Rules:
- Distinguish breadth from size: one enterprise account is narrow reach even if high-value (that belongs in Impact, not here).
- Count distinct requesters/accounts where available, not raw mention volume.
- If raw_signals is sparse, score conservatively (2 or lower) and state what's missing.

Return per idea: { "idea_id", "suggested_reach": <1-5>, "rationale", "confidence": "high"|"low" }`;

const IMPACT_PROMPT = `You convert raw signals into an Impact score (1–5) for RICE prioritization. Sources are inconsistent — a ticket count means something different from a sales dollar figure — so normalize onto one comparable scale, don't average them.

Scoring rubric (anchors):

Impact 5 — Would meaningfully move a core metric or unblock significant revenue (deal > $250k, tickets > 100, 3+ enterprise accounts).
Impact 4 — Clear, broad benefit but not existential ($50k–250k, tickets 30–100, recurring weekly request).
Impact 3 — Moderate, affects a meaningful subset ($10k–50k, tickets 10–30, one enterprise account recurring).
Impact 2 — Narrow benefit (<$10k, tickets 3–10, single non-recurring request).
Impact 1 — Minimal, edge case, or insufficient signal.

Rules:
- If signals conflict (high ticket_count, low deal_value), score toward the stronger signal and flag the conflict.
- Sparse data → score conservatively, state what's missing. Never invent numbers not present in raw_signals.

Return per idea: { "idea_id", "suggested_impact": <1-5>, "rationale", "confidence": "high"|"low" }`;

const VALUE_PROMPT = `You convert raw signals into a Value score (1–5) for Value vs. Effort prioritization. Value is a single composite measure of how worthwhile this idea is to build — how many users/accounts it affects AND how much it helps them — combined into one judgment call (there's no separate Reach/Impact split in this framework).

Scoring rubric (anchors, use judgment between values):

Value 5 — High breadth AND high stakes (tickets > 100, deal > $250k, churn risk on multiple enterprise accounts).
Value 4 — Clear, broad benefit or a significant single stake (tickets 30–100, $50k–250k, one enterprise account with churn risk).
Value 3 — Moderate breadth or moderate stakes (tickets 10–30, $10k–50k, recurring request without hard numbers).
Value 2 — Narrow breadth and modest stakes (tickets 3–10, <$10k, a single non-recurring request).
Value 1 — Minimal breadth, minimal stakes, or insufficient signal.

Rules:
- Combine breadth and stakes into one judgment — let the stronger signal carry more weight when they diverge.
- Sparse data → score conservatively, state what's missing. Never invent numbers not present in raw_signals.

Return per idea: { "idea_id", "suggested_value": <1-5>, "rationale", "confidence": "high"|"low" }`;

const CONFIDENCE_PROMPT = `You assign a Confidence score (100%, 80%, 50%, or 20%) for RICE prioritization. Confidence measures how much evidence backs the Reach and Impact estimates for this idea — NOT how good or important the idea is.

You additionally receive suggested_reach, suggested_impact, and the "confidence: high/low" flag + rationale from those prior steps, if available.

Scoring rubric (RICE's standard confidence bands — used exactly, no intermediate values):

100% — High confidence. Backed by hard data: exact counts, verified deal values, direct measurement.
80% — Medium confidence. Some real data, but with gaps or assumptions (deal in pipeline, frequency estimated from a sample).
50% — Low confidence. Mostly qualitative/anecdotal signal, a few data points extrapolated.
20% — Guess. Little to no real signal; scored mostly on gut feel or absence of data.

Rules:
- If the Reach or Impact step already flagged confidence as "low," this idea cannot score above 50% — inherit the weaker link, don't average it away.
- Don't let idea importance influence this score. A guaranteed-important idea with weak data is still low confidence.
- If raw_signals is contradictory, cap at 50% and note the contradiction.

Return per idea: { "idea_id", "suggested_confidence": 100|80|50|20, "rationale" }`;

export function DocumentationButton() {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function scrollTo(id: string) {
    const container = contentRef.current;
    const target = container?.querySelector(`#${id}`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-auto flex items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-text-muted transition hover:bg-surface-2 hover:text-text"
      >
        <BookIcon className="h-4 w-4 shrink-0" />
        Documentation
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8"
            onClick={() => setOpen(false)}
          >
            <div
              className="flex h-full w-full max-w-4xl overflow-hidden rounded-lg border border-border bg-surface shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <nav className="flex w-56 shrink-0 flex-col gap-0.5 border-r border-border bg-surface-2 p-3">
                <p className="mb-2 px-2 font-serif text-sm font-medium text-text">Documentation</p>
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className="rounded-md px-2 py-1.5 text-left text-xs font-medium text-text-muted transition hover:bg-surface hover:text-text"
                  >
                    {s.label}
                  </button>
                ))}
              </nav>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
                  <p className="font-serif text-base font-medium text-text">Quarterly Planner — Documentation</p>
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="text-text-muted hover:text-text"
                  >
                    ✕
                  </button>
                </div>

                <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <div className="flex flex-col gap-8">
                    <DocSection id="getting-started" title="1. Getting Started">
                      <p>
                        <span className="font-medium text-text">What it does:</span> turns a messy idea backlog
                        into a committed quarterly plan.
                      </p>

                      <SubHeading>Quick start walkthrough</SubHeading>
                      <ol className="ml-4 list-decimal space-y-1.5">
                        <li>
                          Ideas arrive automatically from a connected Google Sheet (auto-syncs every 60s, or click{" "}
                          <span className="font-medium text-text">Sync from all requests</span> to pull immediately).
                        </li>
                        <li>
                          On <span className="font-medium text-text">Enrich</span>, review each idea's auto-filled
                          Reach/Impact/Confidence (or Value) — click <span className="font-medium text-text">Suggest (AI)</span>{" "}
                          for anything still blank, or type your own numbers.
                        </li>
                        <li>
                          Resolve any <span className="font-medium text-text">Possible duplicate</span> cards —{" "}
                          <span className="font-medium text-text">Merge</span> combines their context,{" "}
                          <span className="font-medium text-text">Dismiss</span> marks them as distinct.
                        </li>
                        <li>
                          Once every idea is scored, move to <span className="font-medium text-text">Discuss</span> to
                          sanity-check the auto-selected set against your team's capacity — override any idea in or
                          out with its checkmark toggle.
                        </li>
                        <li>
                          Move to <span className="font-medium text-text">Plan</span> — committed ideas are
                          auto-assigned to Month 1/2/3 by cumulative effort. Drag ideas between months in Timeline
                          view, or into "Not this quarter."
                        </li>
                      </ol>
                    </DocSection>

                    <DocSection id="three-stages" title="2. The Three Stages">
                      <p>
                        <span className="font-medium text-text">01 · Enrich — Score every idea.</span> Fill in
                        Reach/Impact/Confidence (RICE) or Value (Value vs. Effort) for every idea, resolve possible
                        duplicates, and add any ideas that didn't come through ingestion via{" "}
                        <span className="font-medium text-text">+ Add Feature</span>.
                      </p>
                      <p>
                        <span className="font-medium text-text">02 · Discuss — Sanity-check the set.</span> Review
                        the score-ranked, capacity-cutoff selection as a team. Override individual ideas in or out,
                        attach a PRD link and start date, and leave comments for the owner.
                      </p>
                      <p>
                        <span className="font-medium text-text">03 · Plan — Commit the quarter.</span> Selected ideas
                        are auto-assigned into Month 1/2/3 by cumulative effort within capacity. Switch between List
                        (grouped by theme) and Timeline (day-precise Gantt) views.
                      </p>
                      <p className="text-xs text-text-muted">
                        Stages aren't gated — the left-rail nav lets you jump to any stage at any time.
                      </p>
                    </DocSection>

                    <DocSection id="scoring-reference" title="3. RICE & Value/Effort Scoring Reference">
                      <SubHeading>Definitions</SubHeading>
                      <ul className="ml-4 list-disc space-y-1">
                        <li>
                          <span className="font-medium text-text">Reach</span> (1–5, RICE only) — breadth: how many
                          distinct users or accounts this affects, not how much it helps them.
                        </li>
                        <li>
                          <span className="font-medium text-text">Impact</span> (1–5, RICE only) — how much it helps
                          the users it reaches.
                        </li>
                        <li>
                          <span className="font-medium text-text">Confidence</span> (100/80/50/20%, RICE only) — how
                          much evidence backs the Reach and Impact estimates, independent of how good the idea is.
                        </li>
                        <li>
                          <span className="font-medium text-text">Value</span> (1–5, Value vs. Effort only) — a
                          single composite judgment combining breadth and stakes into one number.
                        </li>
                        <li>
                          <span className="font-medium text-text">Effort</span> (sprints) — engineering estimate,
                          shared by both frameworks.
                        </li>
                      </ul>

                      <SubHeading>Formulas</SubHeading>
                      <Formula>Score = (Reach × Impact × Confidence) ÷ Effort (sprints)</Formula>
                      <Formula>Score = Value ÷ Effort (sprints)</Formula>

                      <SubHeading>How AI-suggested scores are generated</SubHeading>
                      <p>
                        Each field is scored by its own "judge" call — Reach, Impact, Value, and Confidence are four
                        separate prompts, never one combined call. Every judge receives the idea's{" "}
                        <span className="font-medium text-text">source</span> (slack/jira/support/sales/exec/other),
                        a set of <span className="font-medium text-text">raw_signals</span> extracted with regex from
                        the idea's raw context (ticket count, deal value, "enterprise"/"churn" mentions, exec
                        mentions), and the free-text context itself. The Confidence judge additionally receives the
                        Reach and Impact judges' own confidence flags and rationale, and is instructed to inherit the
                        weaker of the two rather than average it away. Calls go through a{" "}
                        <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs">/api/llm-judge</code>{" "}
                        server proxy so the OpenAI key never reaches the browser.
                      </p>

                      <SubHeading>How to override an AI suggestion</SubHeading>
                      <p>
                        Type directly into any Reach/Impact/Confidence/Value/Effort field at any time — a manual edit
                        always wins and clears the "auto-filled" flag, so the AI (or the regex-based smart-default
                        that ran first) never overwrites it again. To ask the AI again instead, click{" "}
                        <span className="font-medium text-text">Suggest (AI)</span> on a blank field, or{" "}
                        <span className="font-medium text-text">Rescore</span> on a field that already has a value —
                        this re-runs that field's judge only, not the whole idea.
                      </p>

                      <SubHeading>The prompts used</SubHeading>
                      <div className="flex flex-col gap-2">
                        <PromptDetails title="Reach" prompt={REACH_PROMPT} />
                        <PromptDetails title="Impact" prompt={IMPACT_PROMPT} />
                        <PromptDetails title="Value" prompt={VALUE_PROMPT} />
                        <PromptDetails title="Confidence" prompt={CONFIDENCE_PROMPT} />
                      </div>

                      <SubHeading>Worked example</SubHeading>
                      <div className="rounded-md border border-border bg-surface-2 p-3">
                        <p className="font-medium text-text">
                          "SSO / SAML login for enterprise" — source: Sales, context: "$180k deal · enterprise ·
                          churn risk"
                        </p>
                        <ul className="mt-2 ml-4 list-disc space-y-1">
                          <li>
                            <span className="font-medium text-text">Reach = 2</span> — a single account, even though
                            it's large/enterprise, is a small segment by breadth (the $180k belongs in Impact, not
                            here).
                          </li>
                          <li>
                            <span className="font-medium text-text">Impact = 4</span> — deal_value_usd $180k falls in
                            the $50k–250k band.
                          </li>
                          <li>
                            <span className="font-medium text-text">Confidence = 80%</span> — a real dollar figure
                            exists, but it's a pipeline deal, not a closed/verified one.
                          </li>
                          <li>
                            <span className="font-medium text-text">Effort = 3 sprints</span> — engineering estimate,
                            entered manually on Discuss.
                          </li>
                        </ul>
                        <Formula>{"Score = (2 × 4 × 0.80) ÷ 3 = 6.4 ÷ 3 = 2.13"}</Formula>
                      </div>
                    </DocSection>

                    <DocSection id="navigation-ui" title="4. Navigation & UI">
                      <SubHeading>Left-rail stage navigator</SubHeading>
                      <p>
                        The three numbered stage buttons (Enrich/Discuss/Plan) jump straight to that stage — nothing
                        is gated behind completing an earlier one. Each shows a progress pill (done/total) for that
                        stage's own completion metric: Enrich counts fully-scored ideas, Plan counts
                        committed-or-deprioritized ideas, Discuss has no checklist (it's a free-form review pass).
                        The top of the rail holds the Google Sheet sync control — auto-syncs every 60 seconds, or
                        trigger it manually.
                      </p>

                      <SubHeading>Triggering AI assist</SubHeading>
                      <p>
                        Nothing scores itself automatically. Every AI call is opt-in, button-based: "Suggest (AI)" on
                        a blank field, "Rescore" on a filled one, or the "Generate scores with AI" checkbox when
                        adding a manual feature. A PM's own typed value always overrides and is never silently
                        replaced.
                      </p>

                      <SubHeading>Ideas table (Enrich)</SubHeading>
                      <p>
                        Columns are Idea (title, description, source badge, and any detected signal chips like
                        ticket counts or deal size), then Reach/Impact/Confidence (RICE) or Value (Value vs. Effort).
                        Click any column header to sort ascending/descending; hovering the Score column header shows
                        the live formula. Click a row's pencil icon to edit that row inline (title, description, raw
                        context, scores), or "Edit Table" to put every row into edit mode at once. The checkmark and
                        archive icons mark an idea done or archive it without deleting its data.
                      </p>
                    </DocSection>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
