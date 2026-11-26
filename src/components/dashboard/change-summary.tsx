import { summariseChanges, type Names } from "@/lib/change-summary";

/** An audit record's changes as readable lines, with the raw record kept for audits. */
export function ChangeSummary({ changes, names, className = "" }: { changes: unknown; names?: Names; className?: string }) {
  const lines = summariseChanges(changes, names);
  if (!lines.length) return null;
  return (
    <div className={`mt-2 text-sm ${className}`}>
      <dl className="grid gap-1">
        {lines.map((line, i) => (
          <div key={`${line.label}-${i}`} className="grid gap-x-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-[var(--ink-muted)]">{line.label}</dt>
            <dd className="whitespace-pre-wrap break-words">{line.value}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-2">
        <summary className="cursor-pointer text-2xs text-[var(--ink-faint)]">Raw record</summary>
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded bg-[var(--paper-sunken)] p-2 text-2xs">
          {JSON.stringify(changes, null, 2)}
        </pre>
      </details>
    </div>
  );
}
