interface StepperProps {
  label: string;
  value: number | undefined;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  autoFilled?: boolean;
  /** Table-cell mode: no label row, auto-filled shown as a ring instead of a text tag. */
  compact?: boolean;
  onChange: (value: number) => void;
}

export function Stepper({
  label,
  value,
  min = 0,
  max,
  step = 0.5,
  suffix = "",
  autoFilled,
  compact,
  onChange,
}: StepperProps) {
  const clamp = (n: number) => (max !== undefined ? Math.min(max, n) : n);
  const isAutoFilled = autoFilled && value !== undefined;

  return (
    <div className={`flex flex-col gap-1 ${compact ? "w-full" : "min-w-[100px]"}`}>
      {!compact && (
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          {label}
          {isAutoFilled && <span className="text-[10px] font-medium text-accent">auto-filled</span>}
        </span>
      )}
      <div className={`flex items-center gap-1 ${compact ? "justify-center" : ""}`}>
        <input
          type="number"
          value={value ?? ""}
          placeholder="—"
          min={min}
          max={max}
          step={step}
          title={isAutoFilled ? `${label}: auto-filled from detected signal` : undefined}
          onChange={(e) => onChange(clamp(Math.max(min, Number(e.target.value))))}
          className={`w-14 rounded-md border px-1.5 py-1 text-center text-sm tabular-nums outline-none focus:border-accent ${
            compact && isAutoFilled ? "border-accent-border bg-accent-soft" : "border-border bg-surface"
          }`}
        />
        {suffix && <span className="text-xs text-text-muted">{suffix}</span>}
      </div>
    </div>
  );
}
