import { requireUser } from "@/lib/session";
import { readClientQuote } from "@/lib/client-portal";
import { renderQuotePdf } from "@/lib/quote-pdf";
import { renderQuoteHtml } from "@/lib/quote-render";
import type { QuoteSnapshot } from "@/lib/quote-rules";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A customer's own quote: a PDF by default, or HTML with ?format=html. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string; id: string }> },
) {
  const user = await requireUser("/account/enquiries"),
    { reference, id } = await params,
    q = await readClientQuote(user.id, reference, id);
  if (!q) return new Response("Not found", { status: 404 });
  const snapshot = q.snapshot as QuoteSnapshot;
  const name = `quotation-${snapshot.reference}-v${q.number}`.replace(/[^\w.-]+/g, "-");
  const common = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (new URL(request.url).searchParams.get("format") === "html")
    return new Response(renderQuoteHtml(snapshot), {
      headers: {
        ...common,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.html"`,
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  return new Response(Buffer.from(await renderQuotePdf(snapshot)), {
    headers: { ...common, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` },
  });
}
