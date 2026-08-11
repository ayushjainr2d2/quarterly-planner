export function SearchInput({
  value,
  onChange,
  placeholder = "Search by title…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-56 shrink-0">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-surface py-1.5 pl-2.5 pr-7 text-xs text-text outline-none focus:border-accent"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-faint hover:text-text"
        >
          ✕
        </button>
      )}
    </div>
  );
}
