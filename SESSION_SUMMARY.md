# Quarterly Planner — Session Handoff Summary

Project: "Quarterly Planning & Prioritization Tool" for PMs.
Location: `quarterly-planner/` under `C:\Claude Code\Product Prioritisation Tool\`.
Stack: React + TypeScript + Vite SPA, Zustand store (`useWorkspaceStore.ts`), no backend except a Vercel serverless `/api/llm-judge` proxy for OpenAI. Static site, all state in-memory (localStorage-persisted).

Read `CLAUDE.md` in the repo root and in `quarterly-planner/` first — it documents the architecture, file layout, and conventions in detail and stays up to date independent of this summary.

## Dev environment
- `cd quarterly-planner && npm run dev` — plain Vite dev server, port 5173 (no `/api` routes).
- `npx vercel dev --yes --listen 3000` — serves the app AND `/api/llm-judge`, port 3000. This process has gone stale/died multiple times this session (long-running, doesn't always pick up file changes) — if things look outdated on port 3000, kill and restart it fresh.
- Always run `npm run build` (tsc -b && vite build) after changes — no test suite exists, this is the correctness gate.
- `npm run lint` uses oxlint (not eslint).

## Major features built this session (chronological, all shipped/verified)

1. **Editable raw context on Enrich** — PMs can add customer signals after ingestion; `Rescore` re-runs the AI judge using the edited context. Fixed a bug where the 60s Google Sheet sync was silently clobbering manual edits (`rawContextEdited`/`descriptionEdited` flags now guard sync overwrites).
2. **Archive + Done lifecycle** for ideas (Enrich page): `archivedAt`/`doneAt` timestamps, 90/180-day auto-purge, collapsible "Archived"/"Done" sections at the bottom, restore/reopen actions. `lib/archive.ts`.
3. **Title search + highlighting** on both Enrich and Discuss (`shared/SearchInput.tsx`, `shared/HighlightedText.tsx`).
4. **Icon-based row actions** — Edit/Done/Archive as icons (`shared/icons.tsx`) instead of text buttons, sized to match the score numbers.
5. **"In Planning" collapsible section on Enrich** — committed ideas collapse out of the main review list; defaults open. ALL active (non-done/non-archived) ideas now live here regardless of status.
6. **Discuss page redesign — selection model replaced the old capacity-cutoff drag-reorder line.** This was a big architectural change:
   - Removed drag-to-reorder entirely (`Idea.order` field, `reorderIdeas` action — deleted).
   - Added `Idea.selectionOverride?: boolean` — a PM can explicitly select/unselect any idea regardless of automatic ranking.
   - `computeSelection()` in `lib/scoring.ts` is the single source of truth: auto-selects ideas in score-priority order up to capacity, then applies overrides. **Unscored ideas (missing any of reach/impact/confidence/effort) default to NOT selected**, even if an override forces one in.
   - Each row shows a green checkmark toggle + "Selected"/"Not selected" tag — the whole control (icon + tag) is one click target, positioned above the title.
   - The header's capacity bar (`CapacityIndicator.tsx`) and Discuss's own capacity math both use `computeSelection()` now — always computed against the FULL active idea set, never the filtered/search view (a bug fixed mid-session).
   - Plan's `autoAssignQuarters` (`lib/plan.ts`) also uses `computeSelection()` so the initial Plan auto-generation respects Discuss's selection state instead of a blind score cutoff.
7. **PRD link + Start Date on Discuss**, next to Owner:
   - `Idea.prdUrl` — "Add PRD" dashed chip → popover with URL input → "PRD" hyperlink (opens new tab) + pencil edit icon.
   - `Idea.startDate` ("YYYY-MM-DD") — native `<input type="date">`, defaults to today.
   - Category/Owner/PRD/Start-date are now 4 visually-uniform chips (`METADATA_CHIP*` constants in `DiscussPanel.tsx`) forced onto one line.
   - **Gotcha fixed twice**: popovers with `autoFocus` on their input were self-closing instantly because focusing scrolled the input into view, firing a `scroll` event that the popover's own "close on scroll" listener caught. Fixed by replacing `autoFocus` with manual `.focus({preventScroll:true})` in a `useEffect`, in ALL FOUR popover-style controls (`PrdLink`, `CategoryTag`, `CommentThread`, `FilterBar`'s add-filter box). A second related bug: pasting a *long* value scrolled the input's own text internally, which ALSO falsely triggered the close-on-scroll listener (capture-phase catches non-bubbling scroll from descendants) — fixed by having `handleScroll` ignore events whose target is inside the popover itself.
8. **Score tooltip on Discuss** — hovering the "SCORE" column header (not just each row's number) shows the live formula for the active framework (RICE vs Value/Effort), via `scoreExplanation()`/`scoreFormulaLabel()` in `lib/scoring.ts`.
9. **Gantt-style Timeline (Plan page) — day-precise.** This is the most complex recent change:
   - `lib/timeline.ts`: `ideaStartDate()`/`ideaEndDate()` (start date + sprints×14 days), `computeBarPlacement()` returns fractional `{leftPct, widthPct}` against the real calendar (not an averaged 30-day month), clamped to the visible 3-month window.
   - `deliveryRangeLabel()` — List view badge shows the real delivery range, e.g. "Aug 20 - Oct 15, 2026", not just a month name.
   - TimelineView header now shows real calendar months (Aug 2026 / Sep 2026 / Oct 2026) instead of generic "Month 1/2/3".
   - Dragging a bar to a different month column sets `startDate` to the 1st of that month.
   - **Bug fixed**: bars were absolutely-positioned inside a container sized only by an empty drop-zone's `min-h-68px`, so a theme row with 2+ stacked ideas overflowed/overlapped the row below. Fixed by flipping which layer is `absolute` — drop-zones are now the absolute background, bars are normal-flow (so their stacked height drives the row's real height).

## Known non-issues (confirmed correct, don't "fix" again)
- Small-effort ideas (1-2 sprints) showing a single month, not a range: correct math (2 sprints = 28 days < 30-day month threshold... now actually day-precise so this is less relevant, but the principle holds — verify against the real formula before assuming a bug).
- `vercel dev` on port 3000 going stale is an environment issue, not a code bug — just restart it.
- Native browser tooltips (`title` attribute) never show up in automated screenshots — that's expected, verify via the DOM attribute or accessibility tree instead.
- Automated `computer` drag/click tools in this sandbox sometimes have coordinate/timing imprecision (e.g., native month/date-picker calendar icons, drag-drop landing column) — prefer DOM-level verification (`localStorage` state, computed styles, accessibility tree) over pixel-perfect screenshot checks when confirming correctness.

## Working style notes for whoever continues this
- User reviews via annotated screenshots (drawn red circles/arrows on screenshots) — read them carefully, the circle is usually the precise thing to fix, not the whole screenshot.
- User has asked several times for exact literal copy/text — match it precisely rather than paraphrasing.
- Always run build + lint after every change, then verify live in the Claude_Browser tool (localhost:5173) before declaring done — this user checks actual behavior, not just "the code should work."
- When something seems mysteriously broken, suspect: (a) stale `vercel dev`, (b) a localStorage write racing with the live app's own state updates (patch via real UI interaction instead of raw `localStorage.setItem` while the app is running), (c) native browser event quirks (scroll-on-focus, scroll-on-paste) rather than React logic bugs.
