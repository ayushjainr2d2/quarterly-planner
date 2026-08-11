# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project layout

This repo root only holds the original spec docs (PRD, design principles, case study). The actual application — a "Quarterly Planning & Prioritization Tool" for PMs — lives entirely in `quarterly-planner/`. All commands below run from that directory.

## Commands

```bash
cd quarterly-planner
npm run dev       # start Vite dev server (port 5173, or use .claude/launch.json's preview config)
npm run build     # tsc -b && vite build — always run this after changes to catch type errors
npm run lint      # oxlint (not eslint)
npm run preview   # preview the production build
```

No test suite is configured (no test script, no test files) — don't invent one unless asked.

## Architecture

**Static SPA, no backend.** React + TypeScript + Vite. All state lives in a single Zustand store (`src/store/useWorkspaceStore.ts`) held in browser memory — a page refresh resets everything back to the ingested data. There is no auth, no server, no traditional database.

**Data ingestion is a live Google Sheet, not a hardcoded seed.** `src/lib/googleSheetSync.ts` fetches the sheet's public CSV export directly from the browser (no API key — the sheet must have "Anyone with the link" viewer sharing enabled, since there's no backend to hold credentials). `App.tsx` triggers a sync on load and polls every 60s; `WorkspaceRail` also exposes a manual "Sync" button. `src/data/seedIdeas.ts` is the fallback/original dataset the sheet was seeded from. Sync merges by the sheet's `id` column: it refreshes ingestion fields (title/description/source/raw_context, and theme/owner only if non-blank) but never touches a PM's in-app scores/status/pins, and never deletes an idea that disappears from the sheet.

**Store is the only place business logic mutates state.** Components dispatch store actions; the store's internal `recalc()`/`deriveStatus()` helpers keep `computedScore` and `status` in sync after every mutation. Pure calculation logic lives in `src/lib/*.ts` and is imported by the store, not duplicated in components:
- `scoring.ts` — RICE / value-effort / weighted-scoring formulas, the sprint↔effort_score conversion (`effort_score = sprints * 2`, always go through `effortScoreFromSprints`/`sprintsFromEffortScore`, never hardcode the factor), and `computeCapacityCutoff` (a strict priority-order walk down the sorted list — once capacity is exceeded, everything after is "below the line," it does not knapsack-optimize for smaller items that would still fit).
- `smartDefaults.ts` — regex-based auto-fill of Reach/Impact/Confidence from `raw_context` (ticket counts, deal size, "enterprise"/"churn" keywords). Only fills fields still undefined; never overwrites a PM's entry.
- `duplicateDetection.ts` — deterministic Jaccard token-overlap similarity on title+description, no ML dependency.
- `aiAssist.ts` — the "Discuss" stage's conflict/cut/inconsistency suggestions are **deterministic mock logic, not a live LLM call** (explicit PRD non-goal). Swap this file if wiring in a real model later.
- `plan.ts` — auto-assigns committed ideas to Month 1/2/3 by cumulative effort as a starting point for the Plan stage.
- `completion.ts` — per-stage progress counts shown in `WorkspaceRail`.

**Framework switching never deletes score data.** `remapScoresForFramework` in `scoring.ts` spreads all existing score fields and only fills the *target* framework's empty field from a compatible source (RICE `impact` ↔ value-effort `value`) — switching to Weighted and back must round-trip RICE data losslessly.

**Duplicate merge combines context, not just picks a winner.** `mergeIdeas` in the store keeps the higher-scored idea, but concatenates the dropped idea's `raw_context` onto it (labeled with its source/title) and re-runs smart-defaults against the combined context, since the merge can surface signals neither idea had alone. The dropped idea is never deleted — it's marked `duplicateOf` the survivor. `activeIdeas()` (`completion.ts`) is the filter every view uses to exclude duplicated-away ideas.

**Component structure mirrors the 4-stage workflow** (`WorkspaceRail` stage nav, not routing — `App.tsx` switches on `stage` from the store): `StageEnrich/`, `StageOrganize/`, `StageDiscuss/`, `StagePlan/`, plus `shared/` for cross-stage primitives (`Stepper`, `Badge`, `DuplicateCard`, `IdeaContextDetails`, `FrameworkSwitcher`). All 4 stages render ideas as individually-bordered `bg-surface` card rows with a gap between them (not a flat table with divider lines) — keep new row UI consistent with that pattern.

**Design tokens** live in `src/index.css` as CSS custom properties (light theme in `:root`, dark theme under `@media (prefers-color-scheme: dark)`), registered into Tailwind v4's utility generator via an `@theme` block (there is no `tailwind.config.js` — Tailwind v4 uses this CSS-first config). Text color has a deliberate 3-tier hierarchy — respect it when adding UI:
- `text` — headers and primary titles (near-white, ~19:1 contrast)
- `text-secondary` — body/description copy (~10:1)
- `text-muted` — secondary metadata like signal chips, labels (~7:1)
- `text-faint` — **decorative icons only** (chevrons, sort arrows) — it fails WCAG AA for real text (~3.5:1), so never use it for anything a user needs to read.

Tooling: Tailwind v4 + `@tailwindcss/postcss`, oxlint (not eslint), `@dnd-kit` for the Plan stage's Timeline drag-and-drop, `framer-motion` for expand/collapse and completion micro-animations, `papaparse` for the Sheet CSV.
