import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "amber" | "green" | "red";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-2 text-text-muted border-border",
  accent: "bg-accent-soft text-accent border-accent-border",
  amber: "bg-amber-soft text-amber border-amber-border",
  green: "bg-green-soft text-green border-green",
  red: "bg-red-soft text-red border-red",
};

/** The app's one signature motif: every status/source/flag tag reads like a
 * stamp on a case file — bordered, uppercase, letter-spaced, monospace —
 * rather than a soft SaaS pill. Reused everywhere a tag appears so it lands
 * as a deliberate choice, not decoration. */
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
