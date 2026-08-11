export function PencilIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M13.3 3.3a1.5 1.5 0 0 1 2.1 2.1L6.4 14.5l-3.1.7.7-3.1 9.3-9.3Z" />
    </svg>
  );
}

export function CheckIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 10.5 8 14.5 16 5.5" />
    </svg>
  );
}

export function BookIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10 5.5c-1-1-2.6-1.5-4.5-1.5S2.2 4.4 2 4.7v10.3c.2-.3 1.6-.5 3.5-.5s3.5.5 4.5 1.5m0-10.5c1-1 2.6-1.5 4.5-1.5s3.3.4 3.5.7v10.3c-.2-.3-1.6-.5-3.5-.5s-3.5.5-4.5 1.5m0-10.5v10.5" />
    </svg>
  );
}

export function TrashIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m-6.5 0 .7 9.9A1.5 1.5 0 0 0 7.7 17.4h4.6a1.5 1.5 0 0 0 1.5-1.5L14.5 6" />
    </svg>
  );
}
