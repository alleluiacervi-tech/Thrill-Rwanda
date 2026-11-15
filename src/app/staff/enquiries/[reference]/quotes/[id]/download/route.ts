import { readAccessibleQuote } from "@/lib/quote-access";
import { renderQuoteHtml } from "@/lib/quote-render";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string; id: string }> },
) {
  const { reference, id } = await params;
  const { quote, snapshot } = await readAccessibleQuote(reference, id);
  return new Response(renderQuoteHtml(snapshot), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="quotation-v${quote.number}.html"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
