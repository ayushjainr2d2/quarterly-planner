# PRD — Quarterly Planning & Prioritization Tool

## 1. Executive Summary

PMs spend the first two weeks of every quarter doing the same manual work: pulling requests out of Slack, support tickets, sales calls, and exec asks, wrestling them into a spreadsheet, applying a scoring framework by hand, and defending the resulting list in a planning meeting where half the questions are about how a number was arrived at. The Quarterly Planning & Prioritization Tool replaces that spreadsheet with a single workspace that scores a pre-loaded idea backlog (RICE or Value/Effort), surfaces AI-assisted suggestions the PM stays in control of, and turns the scored backlog into a committed, defensible quarterly plan — without ever locking the PM into a rigid wizard or a black-box AI decision.

## 2. Problem Statement

Planning and prioritization is a persistent, recurring tax on a PM's time. Every quarter, a PM must intake feature requests from customers, internal stakeholders, support teams, sales, and execs, then distill them into a plan using a framework that maximizes impact on the metrics that matter. Today this looks like:

1. Pulling data out of multiple disconnected systems (Slack, JIRA, support tools, sales CRM, exec conversations).
2. Consolidating it into a spreadsheet by hand.
3. Applying one or more prioritization frameworks — inconsistently, since different sources carry different kinds of signal.
4. Producing a quarterly plan that then has to be shared back with the team and defended, often without a clear record of *why* each idea landed where it did.

This is slow, inconsistent across sources, and hard to defend in a planning meeting.

## 3. Objective

A focused workspace that takes an already-ingested backlog of feature ideas, scores it fast (RICE by default, switchable to Value vs. Effort), lets the PM sanity-check the resulting set with lightweight, scoped AI assistance, and produces a plan that's actually defensible — because every score, override, and cut has a visible rationale attached to it. The tool is one continuous workspace across three stages (Enrich → Discuss → Plan), not a set of disconnected screens or a locked step-by-step wizard — a PM can jump to any stage at any time.

## 4. Non-Goals

- **Ingestion pipeline** — ideas arrive pre-loaded from a seed spreadsheet.
- **Export** — assumed handled downstream.
- **Auth / multi-user permissions.**
- **Open-ended AI chat** — assist is button-triggered and scoped, never a free-form prompt box.
- **Arbitrary custom-criteria framework builder** — v1 ships RICE + Value/Effort.
- **Learning-from-feedback loop that tunes scoring over time** (flagged as a v2 idea only).

## 5. Primary User

A single PM running quarterly planning solo, working through a batch of 20–60 pre-loaded ideas from mixed sources (Slack, JIRA, support tickets, sales requests, exec asks). They own the scoring, the overrides, and the final plan — the tool has no concept of a second seat.

## 6. Challenges for the PM

1. Data from Slack, customer emails, support teams, etc. may not always have all the context needed to prioritize, requiring follow-up.
2. Dependent product teams have their own priorities, and a feature has to compete with those priorities — this makes it difficult to actually follow a priority list once it leaves the tool. *(Out of scope for this project.)*
3. A low-scoring item often needs to be prioritized anyway, purely because of a customer relationship or other factor a formula can't capture.
4. It's difficult to normalize between different types of data — e.g., 10 support tickets vs. 2 sales requests with churn risk on large enterprise accounts; or a request from a company leader based on a handful of customer meetings vs. a competitive analysis of a missing feature.
5. Requests show up across many sources, often with redundant asks for the same underlying thing.
6. Engineering input on effort tends to arrive as part of scope discussions — after Reach and Impact are already understood, not alongside them.

## 7. Solution Summary

| PM Challenge | What Solves It |
|---|---|
| **1. Missing context, needs follow-up** | Every idea's `raw_context` is visible and editable in place on Enrich — a PM can add what they've since learned (another customer asking, a deal update) without leaving the row, then **Rescore** re-runs the AI judge against the updated context. Regex-based smart defaults surface a visible "auto-filled" signal chip (e.g., "$180k deal · enterprise · churn risk") so the PM sees *what* evidence exists at a glance. Every AI-suggested score ships with a one-sentence rationale citing the specific signal it used — and when there isn't enough signal, the Confidence judge is explicitly instructed to score conservatively (≤50%) and say what's missing, so a thin idea reads as "needs follow-up," not as a confident wrong number. |
| **2. Cross-team competing priorities** | Discuss section helps teams discuss and arrive at potential efforts and cuts.|
| **3. Relationship-driven overrides** | On Discuss, every idea has an explicit **selection override** — a one-click checkmark that can force any idea in or out of the committed set regardless of its automatic score-priority ranking. The override is visually distinct from a real high score (a "Selected"/"Not selected" tag, not a score change), so the plan stays honest about *why* an idea is in: comments, a PRD link, and an owner field on the same row let the PM record the actual reason for a reviewer later. |
| **4. Normalizing disparate data types** | Both frameworks reduce every idea to one comparable number regardless of source. Structured signals (ticket count, deal value, customer tier, churn/exec mentions) are extracted from free text the same way no matter which system the idea came from, so a 10-ticket support rollup and a $180k enterprise deal both get judged against the same rubric. Each AI judge prompt is explicitly instructed to normalize dissimilar signal types onto one scale and let the *stronger* signal carry more weight when sources conflict, rather than mechanically averaging incompatible units together. Switching between RICE and Value/Effort re-maps compatible fields instead of resetting data, so normalization work is never lost. |
| **5. Redundant asks across sources** | Deterministic title/description similarity detection flags likely duplicate pairs as a "Possible duplicate" card the PM confirms — never auto-merged silently. **Merge** keeps the higher-scored idea but concatenates the dropped idea's context onto it (labeled with its source) and re-runs smart defaults, since the combined signal from both asks can surface something neither had alone. The dropped idea is never deleted — it's retained and marked as merged, so the audit trail survives. |
| **6. Effort arrives after Reach/Impact** | Effort is tracked as an independent field, not a blocking gate — an idea can be fully scored on Reach/Impact/Confidence (or Value) at Enrich while Effort is still blank, and only counts as "fully scored" (with a real computed score) once Effort lands, typically once eng has scoped it on Discuss. The capacity cutoff and selection recompute live the moment Effort is entered, so a late-arriving estimate immediately reflows the plan instead of requiring a second full pass. |

Beyond the challenge-by-challenge mapping, the workspace ships a **persistent left-rail stage nav** (jump to any stage, nothing gated), a **live capacity indicator** visible from Discuss onward so the cutoff line is never a surprise at commit time, a **day-precise Gantt timeline** for the final plan, and an **in-app documentation panel** covering the scoring formulas, the exact AI prompts used, and a worked example — so the "how was this number arrived at" question in a planning meeting has a built-in answer.

## 8. North Star Metric

**Time-to-Committed-Plan** — average elapsed time, per quarter, from first idea entering the backlog to every idea reaching a final `committed` or `deprioritized` status.

This is the metric that most directly reflects the tool's core promise: turning a messy backlog into a committed, defensible plan *fast*. It only moves in the right direction if scoring, normalization, and sanity-checking are all genuinely reducing PM effort — a tool that just moves the spreadsheet into the browser without cutting real time wouldn't improve it.

## 9. Supporting Metrics

1. **AI-suggestion acceptance rate** — % of AI-suggested scores kept as-is vs. manually overridden. A proxy for how much the PM trusts the judge's normalization; a persistently low rate signals the rubric or prompts need tuning.
2. **Duplicate resolution rate** — % of flagged "possible duplicate" pairs merged or dismissed before a plan is committed. Measures whether the redundant-asks-across-sources challenge is actually being closed out, not just flagged and ignored.
3. **Selection-override rate** — % of committed ideas that required a manual in/out override rather than falling naturally within the automatic capacity cutoff. 
4. **Two-pass scoring rate** — % of committed ideas where Effort was entered after Reach/Impact/Confidence (i.e., in a separate pass), validating that the tool is actually accommodating the "engineering input comes later" workflow rather than forcing a single all-at-once scoring pass.
5. **Adoption** — % of PM's in a company using the tool. Accounts for any possible misses in the core value proposition signalling the need for interviewing and understanding the gap.
