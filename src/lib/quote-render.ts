import { createHash } from "node:crypto";
import { formatQuoteMoney, type QuoteSnapshot } from "@/lib/quote-rules";
// Canonicalize recursively: nested company/line item changes must affect the digest too.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}
export const quoteContentHash = (snapshot: QuoteSnapshot) =>
  createHash("sha256").update(canonical(snapshot)).digest("hex");
const escape = (value: unknown) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const date = (value: string) =>
  new Date(value).toLocaleString("en-GB", { timeZone: "Africa/Kigali" });
/** Customer-facing document. Internal notes, supplier net costs and acceptance evidence never enter this renderer. */
export function renderQuoteHtml(q: QuoteSnapshot) {
  const paragraphs = (title: string, text: string) =>
    `<h2>${escape(title)}</h2><p style="white-space:pre-wrap">${escape(text)}</p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quotation ${escape(q.reference)} v${q.version}</title></head><body style="font-family:Arial,sans-serif;line-height:1.6;color:#173b2c;max-width:800px;margin:32px auto;padding:20px;overflow-wrap:anywhere"><h1>${escape(q.company.name)} — Quotation</h1><p>${escape(q.company.address)}<br>${escape(q.company.email)} · ${escape(q.company.phone)}</p><h2>${escape(q.reference)} · Version ${q.version}</h2><p>Prepared for ${escape(q.customerName)} by ${escape(q.preparedBy)}<br>Issued: ${escape(date(q.issuedAt))}<br>Valid until: ${escape(date(q.expiresAt))}<br>Payment deadline: ${escape(date(q.paymentDeadline))}<br>All times: Kigali (UTC+2)</p>${paragraphs("Service", q.serviceDescription)}${paragraphs("Travel dates, route or itinerary", q.travelSummary)}<table style="width:100%;border-collapse:collapse;table-layout:fixed" border="1" cellpadding="10"><thead><tr><th scope="col">Description</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Total</th></tr></thead><tbody>${q.items.map((line) => `<tr><td>${escape(line.description)} (${escape(line.kind.replaceAll("_", " ").toLowerCase())})</td><td>${line.quantity}</td><td>${escape(formatQuoteMoney(line.unitMinor, q.currency))}</td><td>${escape(formatQuoteMoney(line.totalMinor, q.currency))}</td></tr>`).join("")}</tbody></table><p><strong>Customer total: ${escape(formatQuoteMoney(q.totalMinor, q.currency))}</strong></p>${paragraphs("Taxes and charges", q.taxTreatment)}${paragraphs("Supplier and baggage conditions", q.supplierConditions)}${paragraphs("Payment, change, cancellation and refund terms", q.terms)}<p><strong>A quotation is not a booking or a fare hold.</strong> Availability and confirmation require supplier checks. No ticket is issued by this document. Confirm the current reference/version before accepting.</p></body></html>`;
}

export function renderQuoteText(q: QuoteSnapshot) {
 return [q.company.name, `${q.company.email} · ${q.company.phone}`, `Quotation ${q.reference} · Version ${q.version}`, `Customer: ${q.customerName}`, `Prepared by: ${q.preparedBy}`, `Issued: ${date(q.issuedAt)}`, `Valid until: ${date(q.expiresAt)}`, `Payment deadline: ${date(q.paymentDeadline)} (Kigali, UTC+2)`, "", q.serviceDescription, q.travelSummary, "", ...q.items.map(line => `${line.description} (${line.kind}): ${line.quantity} x ${formatQuoteMoney(line.unitMinor, q.currency)} = ${formatQuoteMoney(line.totalMinor, q.currency)}`), `Customer total: ${formatQuoteMoney(q.totalMinor, q.currency)}`, "", `Taxes and charges: ${q.taxTreatment}`, `Supplier and baggage conditions: ${q.supplierConditions}`, `Payment, changes, cancellation and refunds: ${q.terms}`, "A quotation is not a booking or a fare hold. Availability and confirmation require supplier checks. Confirm the current reference/version before accepting."].join("\n");
}
