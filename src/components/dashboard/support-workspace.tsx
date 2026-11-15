import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { isFinance } from "@/lib/enquiry-workflow";
import { notFound } from "next/navigation";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import {
  OperationsForm,
  type OperationsField,
} from "@/components/dashboard/operations-form";
import { SUPPORT_CATEGORIES, SUPPORT_STATUSES } from "@/lib/launch-rules";
export async function SupportWorkspace({ q = "" }: { q?: string }) {
  const actor = await requireEnquiryStaff();
  if (isFinance(actor)) notFound();
  const [rows, owners] = await Promise.all([
    db.supportCase.findMany({
      where: {
        ...(actor.role === "ADMIN" ? {} : { ownerId: actor.id }),
        ...(q
          ? { reference: { contains: q.slice(0, 80), mode: "insensitive" } }
          : {}),
      },
      include: {
        enquiry: { select: { reference: true } },
        booking: { select: { reference: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 20 },
      },
      orderBy: [{ status: "asc" }, { nextActionAt: "asc" }],
      take: 100,
    }),
    db.user.findMany({
      where: {
        isActive: true,
        ...(actor.role === "ADMIN"
          ? {
              OR: [
                { role: "ADMIN" },
                { staffRole: { in: ["SALES", "OPERATIONS"] } },
              ],
            }
          : { id: actor.id }),
      },
      select: { id: true, fullName: true },
    }),
  ]);
  const common = (r?: (typeof rows)[number]): OperationsField[] => [
    {
      name: "ownerId",
      label: "Responsible owner",
      value: r?.ownerId ?? actor.id,
      options: owners.map((o) => ({ value: o.id, label: o.fullName })),
    },
    {
      name: "category",
      label: "Category",
      value: r?.category,
      options: SUPPORT_CATEGORIES.map((value) => ({ value, label: value })),
    },
    {
      name: "priority",
      label: "Priority",
      value: r?.priority,
      options: ["NORMAL", "URGENT"].map((value) => ({ value, label: value })),
    },
    {
      name: "status",
      label: "Status",
      value: r?.status ?? "OPEN",
      options: SUPPORT_STATUSES.map((value) => ({ value, label: value })),
    },
    {
      name: "summary",
      label: "Issue and required action (no passport/card data)",
      type: "textarea",
      value: r?.summary,
      required: true,
    },
    {
      name: "nextActionAt",
      label: "Next action time (Kigali UTC+2)",
      type: "datetime-local",
      value: r
        ? new Date(r.nextActionAt.getTime() + 7200000)
            .toISOString()
            .slice(0, 16)
        : undefined,
      required: true,
    },
    {
      name: "outcome",
      label: "Resolution and customer handover (required to resolve)",
      type: "textarea",
      value: r?.outcome ?? "",
    },
    {
      name: "evidence",
      label: "Evidence and update reason",
      type: "textarea",
      required: true,
    },
  ];
  const newIntent = randomUUID();
  return (
    <>
      <DashboardHead
        title="After-booking support"
        lede="Every case has an owner, next action and resolution history. Refund cases route work; money is recorded only in the financial workspace."
      />
      <form className="my-4">
        <label>
          Search support reference
          <input
            name="q"
            defaultValue={q}
            className="mx-3 rounded border p-3"
          />
        </label>
        <button className="underline">Search</button>
      </form>
      <OperationsForm
        key={newIntent}
        title="Open a support case"
        hidden={{ command: "SUPPORT", intentKey: newIntent }}
        fields={[
          { name: "enquiryRef", label: "Accepted/mature enquiry reference" },
          ...(actor.role === "ADMIN"
            ? [{ name: "bookingRef", label: "Or existing booking reference" }]
            : []),
          ...common(),
        ]}
      />
      <p>
        Showing up to 100 cases. Search by reference to locate an older case.
      </p>
      {rows.map((r) => (
        <article
          key={r.id}
          className="my-5 min-w-0 rounded-xl border border-[var(--line)] p-5"
        >
          <h2 className="text-xl">
            {r.reference} · {r.status} · {r.priority}
          </h2>
          <p className="mt-2 break-words">{r.summary}</p>
          <p className="mt-2">
            Linked: {r.enquiry?.reference ?? r.booking?.reference} · Next
            action:{" "}
            {r.nextActionAt.toLocaleString("en-GB", {
              timeZone: "Africa/Kigali",
            })}{" "}
            Kigali{" "}
            {r.status !== "RESOLVED" && r.nextActionAt < new Date()
              ? " · OVERDUE"
              : ""}
          </p>
          {r.outcome && <p>Outcome: {r.outcome}</p>}
          <OperationsForm
            key={`${r.id}-${r.version}`}
            title="Update owner, next action or outcome"
            hidden={{
              command: "SUPPORT",
              reference: r.reference,
              version: r.version,
              intentKey: randomUUID(),
            }}
            fields={common(r)}
          />
          <details>
            <summary>Recent case history</summary>
            {r.activities.map((a) => (
              <pre
                key={a.id}
                className="my-3 whitespace-pre-wrap break-words text-xs"
              >
                {a.createdAt.toISOString()} ·{" "}
                {JSON.stringify(a.changes, null, 2)}
              </pre>
            ))}
          </details>
        </article>
      ))}
    </>
  );
}
