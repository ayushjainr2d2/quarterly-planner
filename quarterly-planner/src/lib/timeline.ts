import type { Idea } from "../types";
import { sprintsFromEffortScore } from "./scoring";
import { MONTHS } from "./plan";

const SPRINT_DAYS = 14;
/** Bars are still visible even at 0 width (e.g. unscored effort) so they stay clickable. */
const MIN_BAR_WIDTH_PCT = 3;

/** "YYYY-MM-DD" for the given Date, in local time. */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Local midnight Date for a "YYYY-MM-DD" (or legacy "YYYY-MM", treated as day 1). */
export function parseDateKey(key: string): Date {
  const parts = key.split("-").map(Number);
  const [year, month, day] = parts;
  return new Date(year, month - 1, day || 1);
}

export function todayDateKey(): string {
  return dateKey(new Date());
}

/** "YYYY-MM" for the given Date — used for the 3-month column grid, which is still
 * month-granularity even though start dates are now day-precise. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey(): string {
  return monthKey(new Date());
}

/** Short calendar label ("Aug 2026") for the month `offset` months after the current one. */
export function monthLabel(offset: number): string {
  const d = new Date();
  d.setDate(1); // avoid month-end overflow (e.g. Jan 31 + 1 month skipping to Mar)
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** Short calendar label ("Aug 2026") for a specific "YYYY-MM" key. */
export function formatMonthKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** "Aug 15" — no year, for compact same-year ranges. */
function formatDayMonth(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "Aug 15, 2026" — full date. */
function formatFullDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** How many days an idea's effort takes: 1 sprint = 14 days. */
export function durationDays(idea: Idea): number {
  return sprintsFromEffortScore(idea.scores.effort ?? 0) * SPRINT_DAYS;
}

/** The idea's chosen start date, defaulting to today ("the most recent month/day")
 * when never set. Also accepts the legacy "YYYY-MM" month-only value. */
export function ideaStartDate(idea: Idea): Date {
  return parseDateKey(idea.startDate ?? todayDateKey());
}

export function ideaEndDate(idea: Idea): Date {
  const end = new Date(ideaStartDate(idea));
  end.setDate(end.getDate() + durationDays(idea));
  return end;
}

/**
 * Full delivery window as a display string, built from the exact start date and
 * 1-sprint-=-14-days duration — a single date ("Aug 15, 2026") if effort is 0,
 * a compact same-year range ("Aug 15 - Sep 3, 2026"), or a full range across a
 * year boundary ("Dec 20, 2026 - Jan 3, 2027").
 */
export function deliveryRangeLabel(idea: Idea): string {
  const start = ideaStartDate(idea);
  const end = ideaEndDate(idea);

  if (start.getTime() === end.getTime()) return formatFullDate(start);
  if (start.getFullYear() === end.getFullYear()) {
    return `${formatDayMonth(start)} - ${formatFullDate(end)}`;
  }
  return `${formatFullDate(start)} - ${formatFullDate(end)}`;
}

export interface BarPlacement {
  /** % of the 3-month track width, from the left edge of Month 1. */
  leftPct: number;
  /** % of the 3-month track width. */
  widthPct: number;
}

/**
 * Where an idea's bar sits on the 3-month timeline, computed to day precision:
 * both the idea's start date and its 1-sprint-=-14-days duration are measured in
 * exact days against the real calendar (not an averaged month length), then
 * expressed as a fraction of the visible 3-month window. Clamped so the bar
 * never starts before or runs past the visible window.
 */
export function computeBarPlacement(idea: Idea): BarPlacement {
  const windowStart = new Date();
  windowStart.setDate(1);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setMonth(windowEnd.getMonth() + MONTHS.length);
  const totalWindowDays = daysBetween(windowStart, windowEnd);

  const start = ideaStartDate(idea);
  const end = ideaEndDate(idea);

  const startOffset = Math.min(Math.max(daysBetween(windowStart, start), 0), totalWindowDays);
  const endOffset = Math.min(Math.max(daysBetween(windowStart, end), startOffset), totalWindowDays);

  const leftPct = (startOffset / totalWindowDays) * 100;
  const widthPct = Math.max(((endOffset - startOffset) / totalWindowDays) * 100, MIN_BAR_WIDTH_PCT);

  return { leftPct, widthPct };
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** The "YYYY-MM-DD" (1st of month) for the column at `index` (0/1/2 -> Month 1/2/3),
 * used when a PM drags a bar to a different month column. */
export function dateKeyForIndex(index: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + index);
  return dateKey(d);
}
