import { requireUser } from "@/lib/session";
import { readClientQuote } from "@/lib/client-portal";
import { renderQuoteHtml } from "@/lib/quote-render";
import type { QuoteSnapshot } from "@/lib/quote-rules";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string; id: string }> },
) {
  const user = await requireUser("/account/enquiries"),
    { reference, id } = await params,
    q = await readClientQuote(user.id, reference, id);
  if (!q) return new Response("Not found", { status: 404 });
  return new Response(renderQuoteHtml(q.snapshot as QuoteSnapshot), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename=quotation-v${q.number}.html`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
