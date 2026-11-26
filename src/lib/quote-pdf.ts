import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatQuoteMoney, type QuoteSnapshot } from "@/lib/quote-rules";

/**
 * The customer's quotation as an A4 PDF (brief §7, §17).
 *
 * Built from the same immutable snapshot as the HTML copy, so the two always
 * say the same thing: internal notes, supplier net costs and acceptance
 * evidence never reach this renderer. Uses the PDF standard fonts, so it
 * needs no font files and renders the same on any host.
 */

const A4 = { w: 595.28, h: 841.89 };
const M = 48; // margin
const FOREST = rgb(0x0f / 255, 0x3a / 255, 0x2c / 255);
const SUN = rgb(0xf8 / 255, 0xc3 / 255, 0);
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.38, 0.35, 0.3);
const LINE = rgb(0.86, 0.82, 0.76);
const PAPER = rgb(0.97, 0.95, 0.92);

/** The standard fonts cover Western European text; anything else is replaced rather than crashing the PDF. */
const safe = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff€]/g, "?");

const kigali = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Kigali",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Splits text into lines that fit `width`, keeping the customer's own line breaks. */
function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  for (const para of safe(text).split(/\r?\n/)) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) {
        line = next;
        continue;
      }
      if (line) out.push(line);
      // A single word longer than the line is broken by characters.
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width) {
        let i = w.length;
        while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i--;
        out.push(w.slice(0, i));
        w = w.slice(i);
      }
      line = w;
    }
    out.push(line);
  }
  return out;
}

export async function renderQuotePdf(q: QuoteSnapshot): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Quotation ${q.reference} v${q.version}`);
  pdf.setAuthor(safe(q.company.name));
  pdf.setSubject(`Quotation for ${safe(q.customerName)}`);
  pdf.setCreator(safe(q.company.name));
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);

  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let y = A4.h;
  const width = A4.w - M * 2;

  const newPage = () => {
    page = pdf.addPage([A4.w, A4.h]);
    // A slim band, so continuation pages read as the same document.
    page.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: FOREST });
    y = A4.h - M;
  };
  const need = (h: number) => {
    if (y - h < M + 30) newPage();
  };
  const text = (s: string, x: number, size: number, font = regular, color = INK) =>
    page.drawText(safe(s), { x, y, size, font, color });

  /* ------------------------------------------------------------ header band */
  const band = 118;
  page.drawRectangle({ x: 0, y: A4.h - band, width: A4.w, height: band, color: FOREST });
  page.drawRectangle({ x: 0, y: A4.h - band - 4, width: A4.w, height: 4, color: SUN });
  y = A4.h - 50;
  text(q.company.name, M, 22, serif, rgb(1, 1, 1));
  y -= 18;
  text("QUOTATION", M, 9, bold, SUN);
  const refLine = `${q.reference}  ·  Version ${q.version}`;
  page.drawText(safe(refLine), {
    x: A4.w - M - regular.widthOfTextAtSize(safe(refLine), 9),
    y,
    size: 9,
    font: regular,
    color: rgb(0.85, 0.92, 0.88),
  });
  y -= 16;
  const contact = [q.company.address, q.company.email, q.company.phone].filter(Boolean).join("  ·  ");
  text(contact, M, 8.5, regular, rgb(0.85, 0.92, 0.88));
  y = A4.h - band - 34;

  /* --------------------------------------------------------- key facts grid */
  const facts: [string, string][] = [
    ["Prepared for", q.customerName],
    ["Prepared by", q.preparedBy],
    ["Issued", kigali(q.issuedAt)],
    ["Valid until", kigali(q.expiresAt)],
    ["Payment deadline", kigali(q.paymentDeadline)],
    ["Currency", q.currency],
  ];
  const col = width / 3;
  facts.forEach(([k, v], i) => {
    const cx = M + (i % 3) * col;
    const cy = y - Math.floor(i / 3) * 36;
    page.drawText(safe(k.toUpperCase()), { x: cx, y: cy, size: 7, font: bold, color: MUTED });
    // Fit the column: a long name wraps onto a second, smaller line rather
    // than being cut off or running into the next column.
    const fit = col - 10;
    const one = wrap(safe(v), regular, 10, fit);
    const lines = one.length > 1 ? wrap(safe(v), regular, 8.5, fit).slice(0, 2) : one;
    const size = one.length > 1 ? 8.5 : 10;
    lines.forEach((line, n) => page.drawText(line, { x: cx, y: cy - 13 - n * 10, size, font: regular, color: INK }));
  });
  y -= 36 * 2 + 6;
  text("All times are Kigali time (UTC+2).", M, 7.5, regular, MUTED);
  y -= 22;

  /* ------------------------------------------------------- prose sections */
  const section = (title: string, body: string) => {
    if (!body?.trim()) return;
    const lines = wrap(body, regular, 10, width);
    need(24 + Math.min(lines.length, 4) * 14);
    page.drawText(safe(title), { x: M, y, size: 11.5, font: bold, color: FOREST });
    y -= 16;
    for (const l of lines) {
      need(14);
      text(l, M, 10);
      y -= 14;
    }
    y -= 10;
  };
  section("Service", q.serviceDescription);
  section("Dates, route or itinerary", q.travelSummary);

  /* ------------------------------------------------------------ line items */
  const cols = [
    { label: "Description", x: M + 8, w: width * 0.52 },
    { label: "Qty", x: M + width * 0.56, w: width * 0.08, right: true },
    { label: "Unit price", x: M + width * 0.66, w: width * 0.15, right: true },
    { label: "Total", x: M + width * 0.83, w: width * 0.17 - 8, right: true },
  ];
  const head = () => {
    need(60);
    page.drawRectangle({ x: M, y: y - 6, width, height: 22, color: PAPER });
    for (const c of cols) {
      const s = c.label.toUpperCase();
      page.drawText(s, {
        x: c.right ? c.x + c.w - bold.widthOfTextAtSize(s, 7.5) : c.x,
        y: y + 1,
        size: 7.5,
        font: bold,
        color: MUTED,
      });
    }
    y -= 22;
  };
  head();
  for (const item of q.items) {
    const desc = wrap(`${item.description} (${item.kind.replaceAll("_", " ").toLowerCase()})`, regular, 9.5, cols[0]!.w);
    const rowH = desc.length * 13 + 8;
    if (y - rowH < M + 30) {
      newPage();
      head();
    }
    desc.forEach((l, i) => page.drawText(l, { x: cols[0]!.x, y: y - i * 13, size: 9.5, font: regular, color: INK }));
    const cells = [String(item.quantity), formatQuoteMoney(item.unitMinor, q.currency), formatQuoteMoney(item.totalMinor, q.currency)];
    cells.forEach((v, i) => {
      const c = cols[i + 1]!;
      const s = safe(v);
      page.drawText(s, { x: c.x + c.w - regular.widthOfTextAtSize(s, 9.5), y, size: 9.5, font: regular, color: INK });
    });
    // A hairline under the row's last line of text, then the next row's baseline.
    const under = y - (desc.length - 1) * 13 - 7;
    page.drawLine({ start: { x: M, y: under }, end: { x: M + width, y: under }, thickness: 0.6, color: LINE });
    y = under - 15;
  }

  /* ---------------------------------------------------------------- total */
  need(50);
  y -= 8;
  const total = safe(formatQuoteMoney(q.totalMinor, q.currency));
  const boxW = 220;
  page.drawRectangle({ x: M + width - boxW, y: y - 14, width: boxW, height: 36, color: FOREST });
  page.drawText("CUSTOMER TOTAL", { x: M + width - boxW + 12, y: y + 1, size: 7.5, font: bold, color: SUN });
  page.drawText(total, {
    x: M + width - 12 - bold.widthOfTextAtSize(total, 15),
    y: y - 4,
    size: 15,
    font: bold,
    color: rgb(1, 1, 1),
  });
  y -= 44;

  section("Taxes and charges", q.taxTreatment);
  section("Supplier and baggage conditions", q.supplierConditions);
  section("Payment, change, cancellation and refund terms", q.terms);

  /* ----------------------------------------------------------- disclaimer */
  const note =
    "Availability and confirmation require supplier checks, and no ticket is issued by this document. Before accepting, confirm with us that this is the current version.";
  const noteLines = wrap(note, regular, 9, width - 24);
  const boxH = 16 + 14 + noteLines.length * 12 + 6;
  need(boxH + 8);
  page.drawRectangle({ x: M, y: y - boxH + 12, width, height: boxH, color: PAPER });
  page.drawRectangle({ x: M, y: y - boxH + 12, width: 3, height: boxH, color: SUN });
  page.drawText("A quotation is not a booking or a fare hold.", { x: M + 14, y, size: 9.5, font: bold, color: INK });
  noteLines.forEach((l, i) => page.drawText(l, { x: M + 14, y: y - 14 - i * 12, size: 9, font: regular, color: INK }));

  /* -------------------------------------------------------------- footers */
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const f = safe(`${q.company.name}  ·  ${q.reference}  ·  Version ${q.version}  ·  Page ${i + 1} of ${pages.length}`);
    p.drawLine({ start: { x: M, y: 36 }, end: { x: A4.w - M, y: 36 }, thickness: 0.5, color: LINE });
    p.drawText(f, { x: M, y: 24, size: 7.5, font: regular, color: MUTED });
  });

  return pdf.save();
}
