import { bookingExtras } from "@/lib/booking-extras";

/** A booking's choices and notes, under its name in a table row. */
export function BookingExtrasLine({
  details,
  notes,
  documents = [],
}: {
  details: unknown;
  notes?: string | null;
  /** Car hire: licence and ID copies, opened through the access-checked route. */
  documents?: { id: string; kind: string }[];
}) {
  const extras = bookingExtras(details);
  if (extras.length === 0 && !notes && documents.length === 0) return null;

  return (
    <span className="mt-1 block max-w-[18rem] space-y-0.5 text-2xs text-[var(--ink-muted)]">
      {extras.length ? (
        <span className="block truncate">
          {extras.map((e) => (e.key === "phone" ? e.value : `${e.label}: ${e.value}`)).join(" · ")}
        </span>
      ) : null}
      {documents.length ? (
        <span className="flex gap-3">
          {documents.map((d) => (
            <a
              key={d.id}
              href={`/api/documents/${d.id}`}
              target="_blank"
              rel="noopener"
              className="link-draw font-medium text-clay-700"
            >
              {d.kind === "DRIVING_LICENCE" ? "Licence" : "ID"}
            </a>
          ))}
        </span>
      ) : null}
      {/* Full note on hover; the row stays one line. */}
      {notes ? (
        <span className="block truncate italic" title={notes}>
          “{notes}”
        </span>
      ) : null}
    </span>
  );
}
