import Papa from "papaparse";
import type { Source } from "../types";

/** The published "database" — a Google Sheet the PM can edit directly. */
export const SHEET_ID = "1VAkpf6-_p2ZbhI1_cFFv1jCm5xvAnq5hMoVWVn_tX6E";
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

function sheetCsvUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
}

interface RawSheetRow {
  id?: string;
  title?: string;
  description?: string;
  source?: string;
  raw_context?: string;
  theme?: string;
  owner?: string;
}

export interface IngestedIdeaRow {
  id: string;
  title: string;
  description: string;
  source: Source;
  rawContext: string;
  theme: string;
  owner: string;
}

const VALID_SOURCES: readonly Source[] = ["slack", "jira", "support", "sales", "exec", "other"];

function normalizeSource(raw: string | undefined): Source {
  const lower = (raw ?? "").trim().toLowerCase();
  return (VALID_SOURCES as readonly string[]).includes(lower) ? (lower as Source) : "other";
}

export class SheetSyncError extends Error {}

/**
 * Reads the ingestion sheet's CSV export. Requires the sheet's sharing setting
 * to be "Anyone with the link" (Viewer) — this app has no backend, so the
 * browser fetches the sheet directly with no auth.
 */
export async function fetchIdeasFromSheet(sheetId: string = SHEET_ID): Promise<IngestedIdeaRow[]> {
  let res: Response;
  try {
    res = await fetch(sheetCsvUrl(sheetId), { cache: "no-store" });
  } catch {
    // Most often this means the sheet isn't shared publicly yet: Google redirects
    // unauthenticated requests to a sign-in page, and the browser blocks that
    // cross-origin redirect as a network error rather than a readable response.
    throw new SheetSyncError(
      'Could not reach the sheet. In Google Sheets, click Share → General access → "Anyone with the link" (Viewer), then sync again.'
    );
  }

  if (!res.ok) {
    throw new SheetSyncError(
      `Sheet request failed (${res.status}). In Google Sheets, set Share → General access to "Anyone with the link".`
    );
  }

  const text = await res.text();
  if (text.trim().startsWith("<")) {
    throw new SheetSyncError(
      'This sheet isn\'t publicly viewable yet. In Google Sheets, click Share → General access → "Anyone with the link" (Viewer), then sync again.'
    );
  }

  const parsed = Papa.parse<RawSheetRow>(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new SheetSyncError(`Couldn't parse the sheet: ${parsed.errors[0].message}`);
  }

  return parsed.data
    .filter((row): row is RawSheetRow & { id: string; title: string } => !!row.id?.trim() && !!row.title?.trim())
    .map((row) => ({
      id: row.id.trim(),
      title: row.title.trim(),
      description: (row.description ?? "").trim(),
      source: normalizeSource(row.source),
      rawContext: (row.raw_context ?? "").trim(),
      theme: (row.theme ?? "").trim(),
      owner: (row.owner ?? "").trim(),
    }));
}
