import { db } from "@/lib/db";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { canFinance } from "@/lib/finance-rules";
import { paymentRegisterWhere, paymentRowInclude } from "@/lib/collections/register";

const cell = (value: string | number | null | undefined) => {
  const string = String(value ?? "");
  return '"' + (/^[\s]*[=+\-@]|^[\t\r\n]/.test(string) ? "'" + string : string).replaceAll('"', '""') + '"';
};

export async function GET(request: Request) {
  const actor = await requireEnquiryStaff();
  if (!canFinance(actor)) return new Response(null, { status: 403 });
  const rows = await db.collectionAttempt.findMany({
    where: paymentRegisterWhere(Object.fromEntries(new URL(request.url).searchParams)),
    include: paymentRowInclude, orderBy: { createdAt: "desc" }, take: 5001,
  });
  if (rows.length > 5000) return new Response("Narrow the date range or filters before exporting.", { status: 422 });
  const header = ["Invoice", "Booking or enquiry", "Service", "Merchant reference", "Provider reference", "Provider", "Environment", "Status", "Currency", "Requested minor", "Verified minor", "Fee minor", "Net settled minor", "Method", "Settlement", "Created UTC", "Verified UTC", "Settled UTC"];
  const lines = rows.map((row) => [
    row.invoice.number, row.invoice.booking?.reference ?? row.invoice.financialCase?.enquiry.reference,
    row.invoice.booking?.serviceType ?? row.invoice.financialCase?.enquiry.service,
    row.merchantReference, row.providerReference, row.provider, row.environment, row.status, row.currency,
    row.amountMinor, row.status === "SUCCESSFUL" ? row.amountMinor : null, row.feeMinor, row.settledAt ? row.amountMinor - (row.feeMinor ?? 0) : null,
    row.method, row.settlementStatus, row.createdAt.toISOString(), row.verifiedAt?.toISOString(), row.settledAt?.toISOString(),
  ]);
  return new Response([header, ...lines].map((row) => row.map(cell).join(",")).join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="thrill-payment-collections.csv"', "Cache-Control": "private, no-store" },
  });
}
