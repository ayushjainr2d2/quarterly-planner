import type { AutoFilledFields, Idea, Scores } from "../types";

interface ParsedSignals {
  ticketCount?: number;
  dealSize?: number;
  enterprise: boolean;
  churn: boolean;
}

function parseSignals(rawContext: string): ParsedSignals {
  const text = rawContext.toLowerCase();

  const ticketMatch = text.match(/(\d+)\s+tickets?/);
  const dealMatch = text.match(/\$\s?(\d+(?:\.\d+)?)\s?k/);

  return {
    ticketCount: ticketMatch ? parseInt(ticketMatch[1], 10) : undefined,
    dealSize: dealMatch ? parseFloat(dealMatch[1]) * 1000 : undefined,
    enterprise: text.includes("enterprise"),
    churn: text.includes("churn"),
  };
}

function scaleTicketsToReach(count: number): number {
  if (count >= 60) return 5;
  if (count >= 35) return 4;
  if (count >= 20) return 3;
  if (count >= 5) return 2;
  return 1;
}

function scaleDealSizeToImpact(dealSize: number): number {
  if (dealSize >= 150000) return 5;
  if (dealSize >= 90000) return 4;
  if (dealSize >= 50000) return 3;
  return 2;
}

/**
 * Reads raw_context for parseable signals (ticket count, deal size, enterprise/churn
 * mentions) and returns a partial score pre-fill + which fields were auto-filled.
 * Only fills fields that are still empty — never overwrites a PM's existing entry.
 */
export function computeSmartDefaults(idea: Idea): {
  scores: Partial<Scores>;
  autoFilled: AutoFilledFields;
} {
  const signals = parseSignals(idea.rawContext);
  const scores: Partial<Scores> = {};
  const autoFilled: AutoFilledFields = {};

  if (idea.scores.reach === undefined && signals.ticketCount !== undefined) {
    scores.reach = scaleTicketsToReach(signals.ticketCount);
    autoFilled.reach = true;
  }

  if (idea.scores.impact === undefined) {
    let impact: number | undefined;
    if (signals.dealSize !== undefined) impact = scaleDealSizeToImpact(signals.dealSize);
    if (signals.churn) impact = 5;
    else if (signals.enterprise) impact = Math.max(impact ?? 0, 4);
    if (impact !== undefined) {
      scores.impact = impact;
      autoFilled.impact = true;
    }
  }

  if (idea.scores.confidence === undefined && (signals.enterprise || signals.churn)) {
    scores.confidence = signals.churn ? 80 : 70;
    autoFilled.confidence = true;
  }

  return { scores, autoFilled };
}

export function signalSummary(rawContext: string): string | null {
  const s = parseSignals(rawContext);
  const parts: string[] = [];
  if (s.ticketCount) parts.push(`${s.ticketCount} tickets`);
  if (s.dealSize) parts.push(`$${Math.round(s.dealSize / 1000)}k deal`);
  if (s.enterprise) parts.push("enterprise");
  if (s.churn) parts.push("churn risk");
  return parts.length ? parts.join(" · ") : null;
}
