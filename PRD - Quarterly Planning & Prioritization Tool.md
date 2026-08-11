# PRD — Quarterly Planning & Prioritization Tool for PMs

## 1\. Problem

PMs intake feature requests from customers, stakeholders, support, and sales, then manually distill them into a quarterly plan — usually via spreadsheets and ad hoc application of a prioritization framework. This is slow, inconsistent across sources, and hard to defend in a planning meeting.

## 2\. Objective

A focused workspace that takes already-ingested feature ideas, scores them fast (RICE by default, switchable), organizes them into one consistent shape regardless of source, lets the PM sanity-check the set with lightweight AI assistance, and produces a defensible quarterly plan — as a continuous workspace, not four disconnected screens.

## 3\. Non-goals (explicit exclusions)

- Ingestion pipeline — ideas arrive pre-loaded from a seed spreadsheet  
- Export — assumed handled downstream  
- Auth / multi-user permissions  
- Open-ended AI chat — assist is button-triggered and scoped, never a free-form prompt box  
- Arbitrary custom-criteria framework builder — v1 ships RICE \+ 2 alternates only  
- Learning-from-feedback loop that tunes scoring over time (flagged as a v2 idea only)

## 4\. Primary user

A single PM running quarterly planning solo, working through a batch of 20–60 pre-loaded ideas from mixed sources (Slack, JIRA, support tickets, sales requests, exec asks).

## 5\. Structural improvement over the original spec

The original doc treats the 4 stages as separate screens. To make the flow feel like one smooth pass rather than four disconnected tools:

- **Persistent left rail** showing the 4 stages (Enrich → Organize → Discuss → Plan) with a completion count per stage (e.g., "12/18 scored"). PM can jump back at any time — nothing is a locked wizard step.  
- **Suggested-next-step banner**, not a forced gate: once every idea in view has a status beyond `unscored`, a dismissible banner appears ("All ideas scored — organize them next") rather than auto-navigating. This preserves PM control while still guiding flow (ties to "Familiar Mental Models" / no surprise navigation).  
- **Running capacity indicator** is visible from Organize onward (not only in the final Plan view), so the PM sees where the cutoff line will likely fall well before reaching Stage 4 — reduces surprise at commit time.

## 6\. Data model

Idea {

  id: string

  title: string

  description: string

  source: "slack" | "jira" | "support" | "sales" | "exec" | "other"

  raw\_context: string          // original ticket/message text, shown on demand for scoring context

  framework: "RICE" | "value\_effort" | "weighted"

  scores: {

    // RICE

    reach?: number (1-5 or raw count, PM-configurable scale)

    impact?: number (1-5)

    confidence?: number (0-100%)

    effort?: number             // derived from sprints, see §8

    // value\_effort

    value?: number (1-5)

    // weighted (v1: fixed criteria list, not user-defined)

    weighted\_criteria?: { name: string, weight: number, score: number }\[\]

  }

  computed\_score: number

  theme: string

  owner: string

  status: "unscored" | "scored" | "organized" | "committed" | "deprioritized"

  duplicate\_of?: string          // id of merge target, if flagged

  quarter\_position?: string      // e.g. "Q1-month1"

  ai\_flags: ("conflict" | "suggested\_cut" | "inconsistent\_score")\[\]

  manually\_pinned?: boolean      // PM override to include below-the-line item

}

Workspace {

  capacity\_person\_sprints: number   // PM-entered, drives the cutoff line

  active\_framework: "RICE" | "value\_effort" | "weighted"

}

## 7\. Stage-by-stage requirements

### Stage 1 — Enrich

**Goal:** score every idea with minimum typing.

- Lightweight table view; each row \= one idea, RICE fields as inline sliders/steppers (Reach, Impact, Confidence) and a plain numeric Effort field expressed in sprints (see §8 for conversion).  
- **Smart defaults:** where `raw_context` contains parseable signals (ticket count, deal size, mentions of "enterprise"/"churn"), pre-fill Reach/Impact and show a small "auto-filled" tag the PM can override in one click.  
- Ideas with any unscored field are visually flagged (not hidden) — amber left-border on the row, not a blocking modal.  
- Row expands on click to show `raw_context` so the PM never has to leave the table to find missing detail.  
- **Done state:** every idea has a `computed_score`.

### Stage 2 — Organize & Normalize

**Goal:** bring every idea into one consistent shape regardless of source.

- Board/table with columns: Title, Theme/Tag, Source, Score Breakdown, Owner, Status — sorted by `computed_score` descending by default.  
- **Duplicate detection:** title/description similarity flags likely duplicates as a linked pair with a "Merge" button (verb-only, per copy principles). Merge is never automatic — PM confirms, and the merged idea keeps the higher score with both sources listed.  
- **Normalization AI prompt:** a "Normalize scores" action that takes the raw context across dissimilar sources (e.g., 10 support tickets vs. 2 enterprise sales asks) and suggests a consistent Reach/Impact rating with a one-line rationale. PM confirms or adjusts — never silently applied.  
- **Capacity line:** PM enters `capacity_person_sprints` once at the top of this view. Cutoff line is drawn automatically in the sorted list where cumulative effort (converted back to sprints) meets that capacity — recalculates live as scores/effort change.  
- **Framework switcher:** single control, default RICE. Alternates: Value vs. Effort (2×2) and Weighted Scoring (fixed v1 criteria set). Switching re-maps compatible fields (e.g., RICE Impact → Value) instead of resetting data.  
- **Done state:** no untagged/unowned/unresolved-duplicate ideas remain, list is in priority order with the capacity line visible.

### Stage 3 — Discuss & Adjust (lightweight AI assist)

**Goal:** let the PM sanity-check the set without a free-form chat.

- Three scoped, button-triggered actions (no prompt box):  
  1. **Summarize conflicts** — flags ideas competing for the same team/capacity in the same window.  
  2. **Suggest cuts** — lowest score-per-effort ideas, one-line rationale each.  
  3. **Flag inconsistent scoring** — e.g., high-Impact idea tagged to a low-priority theme.  
- Suggestions render as dismissible cards next to the affected idea, never as a chat transcript. Accepting a card performs the edit directly (score/status change) with an instant inline confirmation (no separate "saved" toast needed — the row visibly updates).  
- **Manual override:** PM can pin any below-the-line idea into the prioritized set directly (e.g., for a customer-relationship reason), marked `manually_pinned` and visually distinguished (not the same as a normal high score) so the rationale is transparent in the final plan.  
- **Done state:** every AI flag has been accepted, dismissed, or manually edited.

### Stage 4 — Generate the Plan

**Goal:** produce something shareable and defensible.

- **View 1 — Prioritized list:** ranked by score, grouped by theme, capacity line and running effort total always visible.  
- **View 2 — Timeline:** same committed set on a quarter/month grid, drag-adjustable between months; below-the-line/deprioritized ideas shown in a visually distinct collapsed section, never deleted.  
- Switching List ↔ Timeline is a single toggle in place — not a page navigation.  
- **Done state:** committed ideas have a quarter/month position; deprioritized ideas are clearly separated but retained.

## 8\. Effort → sprint conversion

Effort score is derived linearly from sprint estimates: **effort\_score \= sprints × 2** (0.5 sprint → 1, 1 sprint → 2, 1.5 sprints → 3, etc.). The capacity cutoff line converts cumulative effort\_score back to sprints against the PM-entered `capacity_person_sprints`.

## 9\. Sample/seed data (for build & demo)

Since ingestion is out of scope, ship a seed dataset simulating mixed-source ideas: a handful from Slack threads, JIRA tickets, support-ticket rollups, and sales/exec asks — enough variety (\~20–30 ideas) to demonstrate normalization, duplicate detection, and the capacity line meaningfully. Include at least 2 near-duplicate pairs and 2 ideas with missing/incomplete raw context to demonstrate the "flagged, not hidden" and smart-default behaviors.

## 10\. Copy principles

- Buttons: verbs only, no filler ("Merge", not "Merge these two items")  
- Empty states name the next single action, never the whole feature  
- Numbers over adjectives — show the RICE score, not "high priority"

## 11\. Suggested build approach (for Claude Code)

- Single-page React app, in-memory state (no backend/auth needed given non-goals)  
- Seed data loaded from a local JSON file matching the schema in §6  
- Component split: `WorkspaceRail` (stage nav \+ progress), `EnrichTable`, `OrganizeBoard` (+ `CapacityLine`, `DuplicateCard`), `DiscussPanel` (+ `SuggestionCard`), `PlanView` (+ `ListView`, `TimelineView`)  
- All "AI assist" behavior (normalization suggestions, conflict summaries, suggested cuts) can be mocked with deterministic logic against the seed data for the prototype — no live LLM call required unless you want to wire one in later.

## 12\. Open questions / risks

- Weighted Scoring's "fixed v1 criteria set" needs 3–5 concrete criteria named before build — not yet specified.  
- Whether the capacity line should recalculate instantly on every keystroke or on field blur (performance/feel trade-off) — recommend blur for v1.  
- Manual pin count isn't capacity-bounded in this draft — decide whether pinned items count against `capacity_person_sprints` or sit outside it entirely.

