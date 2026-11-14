/** Full-screen "Processing your booking…" while the order is created and the payment page opens. */
export function ProcessingOverlay({
  title = "Processing your booking…",
}: {
  title?: string;
}) {
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label={title}
      className="fixed inset-0 z-[60] grid place-items-center bg-black/30 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-[var(--radius-card)] bg-[var(--paper-raised)] px-8 py-9 text-center shadow-[var(--shadow-lift)]">
        <span
          aria-hidden
          className="mx-auto block size-12 animate-spin rounded-full border-[3px] border-forest-100 border-t-forest-700"
        />
        <p className="mt-6 text-base font-semibold">{title}</p>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">Please do not close this page.</p>
      </div>
    </div>
  );
}
