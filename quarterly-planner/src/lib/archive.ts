import type { Idea } from "../types";

export const ARCHIVE_RETENTION_DAYS = 90;
export const DONE_RETENTION_DAYS = 180;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Days left before a shelved idea (archived or done) is purged; 0 once it's due for removal. */
export function daysUntilPurge(timestamp: string, retentionDays: number): number {
  const elapsedDays = (Date.now() - new Date(timestamp).getTime()) / MS_PER_DAY;
  return Math.max(0, Math.ceil(retentionDays - elapsedDays));
}

/** Drops ideas that have sat in the archive or done list past their retention window. */
export function purgeExpiredArchives(ideas: Idea[]): Idea[] {
  return ideas.filter((i) => {
    if (i.archivedAt && daysUntilPurge(i.archivedAt, ARCHIVE_RETENTION_DAYS) <= 0) return false;
    if (i.doneAt && daysUntilPurge(i.doneAt, DONE_RETENTION_DAYS) <= 0) return false;
    return true;
  });
}
