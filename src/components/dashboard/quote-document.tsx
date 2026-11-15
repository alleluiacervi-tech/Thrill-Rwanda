import Link from "next/link";
import { readAccessibleQuote } from "@/lib/quote-access";
import { renderQuoteHtml } from "@/lib/quote-render";
import { canWriteQuotes } from "@/lib/quotes";
import { PrintQuoteButton } from "@/components/dashboard/quote-editor";
export async function QuoteDocument({
  reference,
  id,
  base,
}: {
  reference: string;
  id: string;
  base: string;
}) {
  const { actor, quote, snapshot } = await readAccessibleQuote(reference, id);
  const body = renderQuoteHtml(snapshot)
    .replace(/^[\s\S]*?<body[^>]*>/, "")
    .replace(/<\/body>[\s\S]*$/, "");
  return (
    <>
      <div className="mb-5 flex flex-wrap gap-4 print:hidden">
        <Link className="underline" href={`${base}/${reference}`}>
          Back to enquiry
        </Link>
        <Link
          className="underline"
          href={`${base}/${reference}/quotes/${id}/download`}
        >
          Download customer copy (HTML)
        </Link>
        <PrintQuoteButton />
      </div>
      <p className="mb-4 print:hidden">
        Historical issued version {quote.number}. Confirm the latest version and
        acceptance state in the enquiry workspace before sharing or accepting.
      </p>
      <article
        className="customer-quote overflow-x-auto [overflow-wrap:anywhere] rounded-xl bg-white p-6 text-black"
        dangerouslySetInnerHTML={{ __html: body }}
      />
      <style>{`@media print { body * { visibility: hidden; } .customer-quote, .customer-quote * { visibility: visible; } .customer-quote { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
      {canWriteQuotes(actor, quote.enquiry.ownerId) && quote.internalNotes && (
        <aside className="mt-6 border p-4 print:hidden">
          <h2>Internal notes — excluded from customer copy</h2>
          <p className="whitespace-pre-wrap">{quote.internalNotes}</p>
        </aside>
      )}
    </>
  );
}
