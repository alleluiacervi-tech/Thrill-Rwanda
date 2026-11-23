import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * The e-ticket itinerary as an A4 PDF. It carries what the traveller shows at
 * the airport and nothing internal: no fare paid, supplier cost, partner
 * evidence or travel-document numbers. Standard PDF fonts keep it portable.
 */

export type ItineraryData = {
  company: { name: string; email: string; phone: string; address: string };
  reference: string;
  pnr: string;
  partner: string;
  issuedAt: string;
  customerName: string;
  passengers: { name: string; kind: string; ticketNumber: string | null; status: string }[];
  segments: {
    airline: string;
    airlineName: string;
    flightNumber: string;
    origin: string;
    originCity: string | null;
    destination: string;
    destinationCity: string | null;
    departLocal: string;
    arriveLocal: string;
    cabin: string;
    bookingClass: string;
    terminal: string;
  }[];
  baggage: string;
  changeRule: string;
  refundRule: string;
  fareBasis: string;
};

const A4 = { w: 595.28, h: 841.89 };
const M = 48;
const FOREST = rgb(0x0f / 255, 0x3a / 255, 0x2c / 255);
const SUN = rgb(0xf8 / 255, 0xc3 / 255, 0);
const LAKE = rgb(0x07 / 255, 0x59 / 255, 0x9a / 255);
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.38, 0.35, 0.3);
const LINE = rgb(0.86, 0.82, 0.76);
const PAPER = rgb(0.97, 0.95, 0.92);

export const pdfSafe = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/→/g, "to")
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff€]/g, "?");

function wrap(value: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  for (const para of pdfSafe(value).split(/\r?\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
      if (line) out.push(line);
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width) {
        let i = rest.length;
        while (i > 1 && font.widthOfTextAtSize(rest.slice(0, i), size) > width) i--;
        out.push(rest.slice(0, i));
        rest = rest.slice(i);
      }
      line = rest;
    }
    out.push(line);
  }
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2027-03-04T09:15" is printed as written: airport-local, no time zone conversion. */
export const localDate = (value: string) => {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
};
export const localTime = (value: string) => value.slice(11, 16);
const cabinLabel = (cabin: string) => cabin.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
const formatTicket = (n: string) => `${n.slice(0, 3)} ${n.slice(3)}`;

export async function renderItineraryPdf(data: ItineraryData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`E-ticket itinerary ${data.reference}`);
  pdf.setAuthor(pdfSafe(data.company.name));
  pdf.setSubject(`Itinerary for ${pdfSafe(data.customerName)}`);
  pdf.setCreator(pdfSafe(data.company.name));
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const width = A4.w - M * 2;
  let page: PDFPage = pdf.addPage([A4.w, A4.h]);
  let y = A4.h;

  const newPage = () => {
    page = pdf.addPage([A4.w, A4.h]);
    page.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: FOREST });
    y = A4.h - M;
  };
  const need = (h: number) => { if (y - h < M + 30) newPage(); };
  const put = (s: string, x: number, size: number, font = regular, color = INK, at = y) =>
    page.drawText(pdfSafe(s), { x, y: at, size, font, color });
  const right = (s: string, xRight: number, size: number, font = regular, color = INK, at = y) =>
    page.drawText(pdfSafe(s), { x: xRight - font.widthOfTextAtSize(pdfSafe(s), size), y: at, size, font, color });

  /* ------------------------------------------------------------ header band */
  const band = 118;
  page.drawRectangle({ x: 0, y: A4.h - band, width: A4.w, height: band, color: FOREST });
  page.drawRectangle({ x: 0, y: A4.h - band - 4, width: A4.w, height: 4, color: SUN });
  y = A4.h - 50;
  put(data.company.name, M, 22, serif, rgb(1, 1, 1));
  y -= 18;
  put("E-TICKET ITINERARY", M, 9, bold, SUN);
  right(`Booking reference  ${data.pnr}`, A4.w - M, 11, bold, rgb(1, 1, 1));
  y -= 16;
  put([data.company.address, data.company.email, data.company.phone].filter(Boolean).join("  ·  "), M, 8.5, regular, rgb(0.85, 0.92, 0.88));
  y = A4.h - band - 34;

  /* ------------------------------------------------------------- key facts */
  const facts: [string, string][] = [
    ["Booked for", data.customerName],
    ["Airline booking ref (PNR)", data.pnr],
    ["Our reference", data.reference],
    ["Issued", localDate(data.issuedAt)],
    ["Ticketing partner", data.partner || "-"],
    ["Fare basis", data.fareBasis || "-"],
  ];
  const col = width / 3;
  facts.forEach(([k, v], i) => {
    const cx = M + (i % 3) * col;
    const cy = y - Math.floor(i / 3) * 36;
    page.drawText(pdfSafe(k.toUpperCase()), { x: cx, y: cy, size: 7, font: bold, color: MUTED });
    page.drawText(pdfSafe(v).slice(0, 34), { x: cx, y: cy - 13, size: 10, font: regular, color: INK });
  });
  y -= 36 * 2 + 14;

  /* --------------------------------------------------------------- flights */
  put("Your flights", M, 13, bold, FOREST);
  y -= 8;
  put("All times are local to each airport.", M, 8, regular, MUTED);
  y -= 18;
  for (const s of data.segments) {
    need(92);
    const top = y;
    page.drawRectangle({ x: M, y: top - 74, width, height: 82, color: PAPER });
    page.drawRectangle({ x: M, y: top - 74, width: 4, height: 82, color: SUN });
    put(`${s.airlineName}  ·  ${s.airline}${s.flightNumber}`, M + 16, 10.5, bold, FOREST, top - 6);
    right(`${cabinLabel(s.cabin)}${s.bookingClass ? `  ·  class ${s.bookingClass}` : ""}`, M + width - 12, 8.5, regular, MUTED, top - 6);
    // Departure on the left, arrival on the right, the airline's route line between.
    const mid = M + width / 2;
    put(localTime(s.departLocal), M + 16, 22, serif, INK, top - 34);
    put(`${s.origin}${s.originCity ? `  ${s.originCity}` : ""}`, M + 16, 9, bold, INK, top - 48);
    put(localDate(s.departLocal), M + 16, 8.5, regular, MUTED, top - 60);
    right(localTime(s.arriveLocal), M + width - 12, 22, serif, INK, top - 34);
    right(`${s.destination}${s.destinationCity ? `  ${s.destinationCity}` : ""}`, M + width - 12, 9, bold, INK, top - 48);
    right(localDate(s.arriveLocal), M + width - 12, 8.5, regular, MUTED, top - 60);
    page.drawLine({ start: { x: mid - 70, y: top - 30 }, end: { x: mid + 70, y: top - 30 }, thickness: 1, color: LAKE });
    page.drawCircle({ x: mid - 70, y: top - 30, size: 2.5, color: LAKE });
    page.drawCircle({ x: mid + 70, y: top - 30, size: 2.5, color: LAKE });
    if (s.terminal) put(`Terminal ${s.terminal}`, mid - 20, 8, regular, MUTED, top - 48);
    y = top - 96;
  }

  /* ------------------------------------------------------------ travellers */
  need(60);
  put("Travellers and tickets", M, 13, bold, FOREST);
  y -= 16;
  page.drawRectangle({ x: M, y: y - 6, width, height: 22, color: PAPER });
  put("TRAVELLER", M + 8, 7.5, bold, MUTED, y + 1);
  put("TYPE", M + width * 0.5, 7.5, bold, MUTED, y + 1);
  right("E-TICKET NUMBER", M + width - 8, 7.5, bold, MUTED, y + 1);
  y -= 24;
  for (const p of data.passengers) {
    need(26);
    const inactive = p.status !== "ACTIVE";
    put(p.name, M + 8, 10, bold, inactive ? MUTED : INK);
    put(p.kind.charAt(0) + p.kind.slice(1).toLowerCase(), M + width * 0.5, 9.5, regular, MUTED);
    right(inactive ? p.status === "VOIDED" ? "Voided" : "Refunded" : p.ticketNumber ? formatTicket(p.ticketNumber) : "Pending", M + width - 8, 10, bold, inactive ? MUTED : INK);
    page.drawLine({ start: { x: M, y: y - 8 }, end: { x: M + width, y: y - 8 }, thickness: 0.6, color: LINE });
    y -= 24;
  }
  y -= 8;

  /* ------------------------------------------------------------ conditions */
  const section = (title: string, body: string) => {
    if (!body.trim()) return;
    const lines = wrap(body, regular, 9.5, width);
    need(24 + Math.min(lines.length, 3) * 13);
    put(title, M, 10.5, bold, FOREST);
    y -= 15;
    for (const line of lines) { need(13); put(line, M, 9.5); y -= 13; }
    y -= 8;
  };
  section("Baggage", data.baggage);
  section("Changes", data.changeRule);
  section("Refunds", data.refundRule);

  /* --------------------------------------------------------------- notices */
  const notice =
    "Carry the passport used for booking, with the validity and any visa your destination requires. Names must match the passport exactly. Check in online or at the airport by the time your airline states, and confirm times with the airline 24 hours before departure. For changes or refunds, contact us before travelling; fees and rules are set by the airline.";
  const lines = wrap(notice, regular, 9, width - 28);
  const boxH = 30 + lines.length * 12;
  need(boxH + 8);
  page.drawRectangle({ x: M, y: y - boxH + 12, width, height: boxH, color: PAPER });
  page.drawRectangle({ x: M, y: y - boxH + 12, width: 3, height: boxH, color: SUN });
  put("Before you travel", M + 14, 9.5, bold);
  lines.forEach((line, i) => put(line, M + 14, 9, regular, INK, y - 14 - i * 12));

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 36 }, end: { x: A4.w - M, y: 36 }, thickness: 0.5, color: LINE });
    p.drawText(pdfSafe(`${data.company.name}  ·  ${data.reference}  ·  PNR ${data.pnr}  ·  Page ${i + 1} of ${pages.length}`), { x: M, y: 24, size: 7.5, font: regular, color: MUTED });
  });
  return pdf.save();
}
