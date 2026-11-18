import { readAccessibleQuote } from "@/lib/quote-access";
import { renderQuotePdf } from "@/lib/quote-pdf";
import { renderQuoteHtml } from "@/lib/quote-render";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The customer's copy of one issued quote: a PDF by default, or HTML with ?format=html. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string; id: string }> },
) {
  const { reference, id } = await params;
  const { quote, snapshot } = await readAccessibleQuote(reference, id);
  const name = `quotation-${snapshot.reference}-v${quote.number}`.replace(/[^\w.-]+/g, "-");
  const common = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
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
    headers: {
      ...common,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}.pdf"`,
    },
  });
}
