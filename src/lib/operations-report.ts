import { db } from "@/lib/db";
import { canUseEnquiries, enquiryScope, CLOSED } from "@/lib/enquiry-workflow";
import { financialSummary } from "@/lib/finance-rules";
import { financeInclude } from "@/lib/finance";
import { csv, OperationsError } from "@/lib/launch-rules";
import type { EnquiryActor } from "@/lib/enquiry-workflow";
export function reportRange(from?: string, to?: string) {
  const today = new Date(Date.now() + 7200000).toISOString().slice(0, 10);
  const end = to ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || !Number.isFinite(Date.parse(end)))
    throw new OperationsError("Choose a valid end date");
  const start =
    from ??
    new Date(Date.parse(`${end}T00:00:00+02:00`) - 6 * 86400000 + 7200000)
      .toISOString()
      .slice(0, 10);
  const valid = (v: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;
  if (
    !valid(start) ||
    !valid(end) ||
    start > end ||
    Date.parse(end) - Date.parse(start) > 92 * 86400000
  )
    throw new OperationsError("Choose a valid date range of at most 93 days");
  return {
    from: start,
    to: end,
    gte: new Date(`${start}T00:00:00+02:00`),
    lt: new Date(Date.parse(`${end}T00:00:00+02:00`) + 86400000),
  };
}
export async function operationsReport(
  actor: EnquiryActor,
  from?: string,
  to?: string,
) {
  const fresh = await db.user.findUnique({
    where: { id: actor.id },
    select: { id: true, role: true, staffRole: true, isActive: true },
  });
  if (!fresh || !canUseEnquiries(fresh))
    throw new OperationsError("Reports access denied");
  actor = fresh;
  if (!canUseEnquiries(actor))
    throw new OperationsError("Reports access denied");
  const range = reportRange(from, to),
    scope = enquiryScope(actor);
  const [rows, unresolved, overdue, support, interactions] = await Promise.all([
    db.enquiry.findMany({
      where: { AND: [scope, { createdAt: { gte: range.gte, lt: range.lt } }] },
      select: {
        id: true,
        reference: true,
        service: true,
        source: true,
        status: true,
        createdAt: true,
        firstResponseAt: true,
        nextFollowUp: true,
        quoteAcceptance: { select: { id: true } },
        quoteVersions: { select: { id: true } },
        financialCase: { include: financeInclude },
      },
      orderBy: { createdAt: "asc" },
      take: 5001,
    }),
    db.enquiry.count({
      where: { AND: [scope, { status: { notIn: CLOSED } }] },
    }),
    db.enquiry.count({
      where: {
        AND: [
          scope,
          { status: { notIn: CLOSED }, nextFollowUp: { lt: new Date() } },
        ],
      },
    }),
    actor.staffRole === "FINANCE" && actor.role !== "ADMIN"
      ? Promise.resolve(null)
      : db.supportCase.groupBy({
          by: ["status"],
          where: actor.role === "ADMIN" ? {} : { ownerId: actor.id },
          _count: true,
        }),
    actor.role === "ADMIN"
      ? db.interactionDaily.findMany({
          where: {
            day: {
              gte: new Date(`${range.from}T00:00:00Z`),
              lt: new Date(Date.parse(`${range.to}T00:00:00Z`) + 86400000),
            },
          },
          orderBy: [{ day: "desc" }, { service: "asc" }],
        })
      : Promise.resolve([]),
  ]);
  if (rows.length > 5000)
    throw new OperationsError(
      "More than 5,000 cases in this range. Choose a shorter range for a complete report",
    );
  const responseHours = rows
    .filter((r) => r.firstResponseAt)
    .map(
      (r) => (r.firstResponseAt!.getTime() - r.createdAt.getTime()) / 3600000,
    )
    .sort((a, b) => a - b);
  const mid = Math.floor(responseHours.length / 2),
    median = responseHours.length
      ? responseHours.length % 2
        ? responseHours[mid]
        : (responseHours[mid - 1] + responseHours[mid]) / 2
      : null;
  const sources = new Map<string, number>(),
    stages = new Map<string, number>();
  for (const r of rows) {
    sources.set(r.source, (sources.get(r.source) ?? 0) + 1);
    stages.set(r.status, (stages.get(r.status) ?? 0) + 1);
  }
  const supplierItems = await db.supplierCommitment.findMany({
    where: { financialCase: { enquiryId: { in: rows.map((r) => r.id) } } },
    select: {
      supplierId: true,
      confirmedAt: true,
      createdAt: true,
      supplier: { select: { name: true, status: true, nextReviewAt: true } },
    },
  });
  const supplierMetrics = new Map<
    string,
    {
      name: string;
      status: string;
      total: number;
      confirmed: number;
      oldestPending: Date | null;
      reviewDue: Date | null;
    }
  >();
  for (const item of supplierItems) {
    const g = supplierMetrics.get(item.supplierId) ?? {
      name: item.supplier.name,
      status: item.supplier.status,
      total: 0,
      confirmed: 0,
      oldestPending: null,
      reviewDue: item.supplier.nextReviewAt,
    };
    g.total++;
    if (item.confirmedAt) g.confirmed++;
    else if (!g.oldestPending || item.createdAt < g.oldestPending)
      g.oldestPending = item.createdAt;
    supplierMetrics.set(item.supplierId, g);
  }
  const confirmedSuppliers = supplierItems.filter(
      (item) => item.confirmedAt,
    ).length,
    committedSuppliers = supplierItems.length;
  return {
    actor,
    range,
    rows,
    unresolved,
    overdue,
    support,
    interactions,
    median,
    sources,
    stages,
    confirmedSuppliers,
    committedSuppliers,
    supplierMetrics,
    quoted: rows.filter((r) => r.quoteVersions.length).length,
    accepted: rows.filter((r) => r.quoteAcceptance).length,
    responded: responseHours.length,
  };
}
export async function reportCsv(
  actor: EnquiryActor,
  kind: string,
  from?: string,
  to?: string,
) {
  const report = await operationsReport(actor, from, to);
  actor = report.actor;
  let output: string;
  if (kind === "finance") {
    if (actor.role !== "ADMIN" && actor.staffRole !== "FINANCE")
      throw new OperationsError("Financial export access denied");
    output = csv([
      [
        "Reference",
        "Currency",
        "Case created (UTC)",
        "Commercial review",
        "Collections minor",
        "Refund paid minor",
        "Refund due minor",
        "Supplier cost minor",
        "Supplier due minor",
        "Supplier recoverable minor",
        "Fee minor",
        "Pass-through reserve minor",
        "Charges minor",
        "Commission minor",
        "Operational contribution minor",
      ],
      ...report.rows
        .filter((r) => r.financialCase)
        .map((r) => {
          const c = r.financialCase!,
            s = financialSummary(c);
          return [
            r.reference,
            c.currency,
            r.createdAt.toISOString(),
            c.reviewed ? "REVIEWED" : "UNREVIEWED",
            s.collections,
            s.customerRefunds,
            s.refundDue,
            s.supplierCost,
            s.supplierDue,
            s.supplierRecoveryDue,
            s.serviceFees,
            s.passThroughReserve,
            s.charges,
            s.commissions,
            s.contribution ?? "UNKNOWN",
          ];
        }),
    ]);
  } else if (kind === "operations")
    output = csv([
      [
        "Reference",
        "Service",
        "Source",
        "Current status",
        "Created UTC",
        "First response UTC",
        "Next follow-up UTC",
        "Quote issued",
        "Accepted",
      ],
      ...report.rows.map((r) => [
        r.reference,
        r.service,
        r.source,
        r.status,
        r.createdAt.toISOString(),
        r.firstResponseAt?.toISOString(),
        r.nextFollowUp?.toISOString(),
        r.quoteVersions.length > 0 ? "YES" : "NO",
        r.quoteAcceptance ? "YES" : "NO",
      ]),
    ]);
  else throw new OperationsError("Unknown export type");
  await db.operationsAudit.create({
    data: {
      actorId: actor.id,
      entityId: "report",
      action: "REPORT_EXPORT",
      evidence: "Permission-scoped download without contacts or travel details",
      changes: {
        kind,
        from: report.range.from,
        to: report.range.to,
        count: report.rows.length,
      },
    },
  });
  return output;
}
