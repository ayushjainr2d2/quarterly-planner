import { useWorkspaceStore } from "../../store/useWorkspaceStore";
import type { Framework } from "../../types";

const OPTIONS: { id: Framework; label: string }[] = [
  { id: "RICE", label: "RICE" },
  { id: "value_effort", label: "Value vs. Effort" },
];

export function FrameworkSwitcher() {
  const framework = useWorkspaceStore((s) => s.workspace.activeFramework);
  const setFramework = useWorkspaceStore((s) => s.setFramework);

  return (
    <div className="flex items-center gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          onClick={() => setFramework(o.id)}
          className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
            framework === o.id
              ? "border-accent text-accent"
              : "border-border text-text-muted hover:border-accent hover:text-accent"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
