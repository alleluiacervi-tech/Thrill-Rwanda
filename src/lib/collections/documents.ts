import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatQuoteMoney } from "@/lib/quote-rules";
import { collectionDocument, type CollectionAccess } from "./checkout";
import { COLLECTION_METHOD_LABEL, type CollectionMethod } from "./rules";

export async function paymentPdfResponse(
  access: CollectionAccess, issuer: { name: string; email: string }, reference?: string,
) {
  const document = await collectionDocument(access, reference);
  if (!document) return new Response("Payment document unavailable", { status: 404 });
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const receipt = document.attempt;
  const title = receipt ? "Payment receipt" : "Commercial payment invoice";
  const money = (amount: number) => formatQuoteMoney(amount, document.currency);
  const date = (at: Date) => at.toLocaleDateString("en-GB", { timeZone: "Africa/Kigali", dateStyle: "medium" });
  let page = pdf.addPage([595, 842]);
  let y = 782;
  function draw(text: string, size = 11, heading = false) {
    // Standard PDF fonts use WinAnsi. Keep data legible and avoid emitting control characters.
    const face = heading ? bold : font;
    const safe = text.replace(/[^\x20-\x7E\xA0-\xFF]/g, " ").trim();
    let line = "";
    for (const word of safe.match(/\S{1,55}/g) ?? []) {
      const joined = line ? `${line} ${word}` : word;
      if (face.widthOfTextAtSize(joined, size) > 505 && line) {
        drawLine(line);
        line = word;
      } else line = joined;
    }
    drawLine(line);
    y -= 8;
    function drawLine(value: string) {
      if (y < 50) { page = pdf.addPage([595, 842]); y = 782; }
      page.drawText(value, { x: 45, y, size, font: face, color: rgb(0.12, 0.23, 0.18) });
      y -= size + 5;
    }
  }
  draw(issuer.name, 24, true);
  draw(title, 17, true);
  if (process.env.APP_ENV !== "production") draw("TESTING ENVIRONMENT", 11, true);
  draw(`Invoice ${document.number}`);
  draw(`Booking or enquiry ${document.reference}`);
  draw(`Prepared for ${document.customerName}`);
  draw(`Invoice issued ${date(document.issuedAt)}`);
  draw(document.description);
  draw(document.taxes.slice(0, 1000));
  if (receipt?.verifiedAt) {
    draw(`Transaction ${receipt.merchantReference}`);
    draw(`Verified ${date(receipt.verifiedAt)}`);
    draw(`Method: ${COLLECTION_METHOD_LABEL[receipt.method as CollectionMethod]}`);
    draw(`Amount received: ${money(receipt.amountMinor)}`, 14, true);
  }
  draw(`Invoice total: ${money(document.totalMinor)}`);
  draw(`Verified payments: ${money(document.paidMinor)}`);
  draw(`Remaining balance: ${money(Math.max(0, document.totalMinor - document.paidMinor))}`);
  draw("Commercial record only. Request the applicable RRA EBM/EIS fiscal invoice separately.");
  draw(issuer.email);
  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${receipt ? `receipt-${receipt.merchantReference}` : document.number}.pdf"`,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
