import { FinancialWorkspace } from "@/components/dashboard/financial-workspace";
import { QuoteWorkspace } from "@/components/dashboard/quote-workspace";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { Pagination } from "@/components/ui/pagination";
import { TableSearch } from "@/components/dashboard/table-search";
import { SelectFilter } from "@/components/dashboard/select-filter";
import { EnquiryTriageForm } from "@/components/dashboard/enquiry-triage-form";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import {
  allowedEnquiryTransitions,
  CLOSED,
  ENQUIRY_STATUSES,
  enquiryScope,
  isFinance,
  label,
  SERVICES,
  SOURCES,
} from "@/lib/enquiry-workflow";
import { db } from "@/lib/db";
import { paginate } from "@/lib/pagination";
import { searchTerm } from "@/lib/table-query";
import type { Prisma } from "@/generated/prisma/client";

type Params = Record<string, string | string[] | undefined>;
const stamp = (d: Date | null) =>
  d ? d.toLocaleString("en-GB", { timeZone: "Africa/Kigali" }) : "Not set";
export async function EnquiryList({
  params,
  base,
}: {
  params: Params;
  base: string;
}) {
  const actor = await requireEnquiryStaff();
  const finance = isFinance(actor);
  const q = searchTerm(params);
  const value = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : "";
  const status = ENQUIRY_STATUSES.find((s) => s === value("status"));
  const where: Prisma.EnquiryWhereInput = {
    AND: [
      enquiryScope(actor),
      ...(q
        ? [
            {
              OR: (finance
                ? ["reference"]
                : ["reference", "name", "phone", "email"]
              ).map((k) => ({ [k]: { contains: q, mode: "insensitive" } })),
            },
          ]
        : []),
      ...(status ? [{ status }] : []),
      ...(SERVICES.includes(value("service") as (typeof SERVICES)[number])
        ? [{ service: value("service") }]
        : []),
      ...(SOURCES.includes(value("source") as (typeof SOURCES)[number])
        ? [{ source: value("source") }]
        : []),
      ...(value("owner") === "mine"
        ? [{ ownerId: actor.id }]
        : value("owner") === "unassigned"
          ? [{ ownerId: null }]
          : []),
      ...(value("due") === "overdue"
        ? [{ nextFollowUp: { lt: new Date() }, status: { notIn: CLOSED } }]
        : []),
    ],
  };
  const page = paginate(params, await db.enquiry.count({ where }));
  const rows = await db.enquiry.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: page.skip,
    take: page.take,
    select: {
      reference: true,
      name: !finance,
      status: true,
      service: true,
      source: true,
      nextFollowUp: true,
      owner: { select: { fullName: true } },
    },
  });
  return (
    <>
      <DashboardHead
        title="Enquiries"
        lede={
          finance
            ? "Financial milestone queue. Contact and travel details are restricted."
            : "Assign, follow up and record progress. Enquiries remain separate from bookings."
        }
      />
      {!finance && (
        <Link className="mb-5 inline-block underline" href={`${base}/new`}>
          Capture a phone, WhatsApp or offline enquiry
        </Link>
      )}
      <TableSearch
        pathname={base}
        placeholder={
          finance ? "Enquiry reference" : "Reference, name, phone or email"
        }
      />
      <div className="my-5 grid gap-3 sm:grid-cols-3">
        <SelectFilter
          pathname={base}
          param="status"
          label="Status"
          options={[
            { value: "", label: "All statuses" },
            ...ENQUIRY_STATUSES.map((s) => ({ value: s, label: label(s) })),
          ]}
        />
        <SelectFilter
          pathname={base}
          param="service"
          label="Service"
          options={[
            { value: "", label: "All services" },
            ...SERVICES.map((s) => ({ value: s, label: label(s) })),
          ]}
        />
        <SelectFilter
          pathname={base}
          param="source"
          label="Source"
          options={[
            { value: "", label: "All sources" },
            ...SOURCES.map((s) => ({ value: s, label: label(s) })),
          ]}
        />
        <SelectFilter
          pathname={base}
          param="owner"
          label="Owner"
          options={[
            { value: "", label: "All accessible owners" },
            { value: "mine", label: "Assigned to me" },
            { value: "unassigned", label: "Unassigned" },
          ]}
        />
        <SelectFilter
          pathname={base}
          param="due"
          label="Follow-up"
          options={[
            { value: "", label: "All follow-ups" },
            { value: "overdue", label: "Overdue" },
          ]}
        />
      </div>
      <TableShell>
        <thead>
          <tr>
            <Th>Reference / service</Th>
            {!finance && <Th>Customer</Th>}
            <Th>Status</Th>
            <Th>Owner / source</Th>
            <Th>Follow-up (Kigali)</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Tr key={row.reference}>
              <Td>
                <Link
                  className="break-all underline"
                  href={`${base}/${row.reference}`}
                >
                  {row.reference}
                </Link>
                <p>{label(row.service)}</p>
              </Td>
              {!finance && <Td>{row.name}</Td>}
              <Td>{label(row.status)}</Td>
              <Td>
                {row.owner?.fullName ?? "Unassigned"}
                <p>{label(row.source)}</p>
              </Td>
              <Td>{stamp(row.nextFollowUp)}</Td>
            </Tr>
          ))}
        </tbody>
      </TableShell>
      {!rows.length && (
        <p className="my-5">No enquiries match these filters.</p>
      )}
      <Pagination
        page={page}
        pathname={base}
        params={params}
        label="enquiries"
      />
    </>
  );
}
export async function EnquiryDetail({
  reference,
  base,
}: {
  reference: string;
  base: string;
}) {
  const actor = await requireEnquiryStaff();
  const finance = isFinance(actor);
  const row = await db.enquiry.findFirst({
    where: { reference, ...enquiryScope(actor) },
    include: {
      owner: { select: { fullName: true } },
      activities: {
        where: finance
          ? { kind: { in: ["FINANCE_MILESTONE", "FINANCE"] } }
          : {},
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { actor: { select: { fullName: true } } },
      },
    },
  });
  if (!row) notFound();
  const owners =
    actor.role === "ADMIN"
      ? await db.user.findMany({
          where: {
            isActive: true,
            OR: [
              { role: "ADMIN" },
              { staffRole: { in: ["SALES", "OPERATIONS"] } },
            ],
          },
          select: { id: true, fullName: true },
        })
      : [];
  const history = finance
    ? []
    : await db.enquiry.findMany({
        where: {
          AND: [
            enquiryScope(actor),
            { contactKey: row.contactKey, id: { not: row.id } },
          ],
        },
        select: { reference: true, service: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
  const details = row.details as Record<string, unknown>;
  return (
    <>
      <Link href={base} className="underline">
        Back to enquiries
      </Link>
      <DashboardHead
        title={`${label(row.service)} enquiry`}
        lede={row.reference}
      />
      <p>
        {label(row.status)} · {row.owner?.fullName ?? "Unassigned"} · first
        response: {stamp(row.firstResponseAt)} · follow-up:{" "}
        {stamp(row.nextFollowUp)}
      </p>
      {!finance && (
        <>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              ["Customer", row.name],
              ["Phone / WhatsApp", row.phone || "Not supplied"],
              ["Email", row.email ?? "Not supplied"],
              ["Reply channel", label(row.replyChannel)],
              ["Source", label(row.source)],
              ["Received (Kigali)", stamp(row.createdAt)],
              ...Object.entries(details)
                .filter(
                  ([key]) =>
                    !["name", "phone", "email", "replyChannel"].includes(key),
                )
                .map(([key, value]) => [
                  label(key.replace(/([A-Z])/g, " $1")),
                  typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value),
                ]),
            ].map(([key, value]) => (
              <div
                key={key}
                className="min-w-0 rounded-xl border border-[var(--line)] p-4"
              >
                <dt className="text-sm">{key}</dt>
                <dd className="mt-2 whitespace-pre-wrap break-words">
                  {value || "Not supplied"}
                </dd>
              </div>
            ))}
          </dl>
          <section className="mt-6">
            <h2 className="text-xl">Consent evidence</h2>
            <p>{row.consentText}</p>
            <p>
              Recorded {stamp(row.createdAt)} · {row.consentVersion} · privacy
              version {row.privacyVersion || "0 (draft)"}
            </p>
          </section>
          <section className="mt-6">
            <h2 className="text-xl">Previous enquiries using this contact</h2>
            <p className="text-sm">
              Matches supplied contact details only; identity is not verified.
              Only records accessible to your workspace are shown. Accounts are
              never merged automatically.
            </p>
            <ul>
              {history.map((h) => (
                <li key={h.reference}>
                  <Link className="underline" href={`${base}/${h.reference}`}>
                    {h.reference} · {label(h.service)} · {label(h.status)}
                  </Link>
                </li>
              ))}
            </ul>
            {!history.length && <p>No other accessible enquiries.</p>}
          </section>
        </>
      )}
      {!finance && <QuoteWorkspace enquiry={row} actor={actor} base={base} />}
      <FinancialWorkspace enquiry={row} actor={actor} />
      <EnquiryTriageForm
        key={row.version}
        reference={row.reference}
        version={row.version}
        status={row.status}
        ownerId={row.ownerId}
        actorId={actor.id}
        admin={actor.role === "ADMIN"}
        finance={finance}
        followUp={
          row.nextFollowUp
            ? new Date(row.nextFollowUp.getTime() + 7200000)
                .toISOString()
                .slice(0, 16)
            : ""
        }
        owners={owners}
        transitions={allowedEnquiryTransitions(actor, row.status).filter(
          (status) =>
            ![
              "QUOTE_SENT",
              "AWAITING_PAYMENT",
              "PARTNER_PROCESSING",
              "CONFIRMED",
              "COMPLETED",
              "REFUNDED",
            ].includes(status),
        )}
      />
      <section className="mt-8">
        <h2 className="text-xl">Activity timeline</h2>
        <p className="text-sm">
          Latest 100 entries. Saved activity cannot be edited through the
          application.
        </p>
        {row.activities.map((a) => (
          <article
            key={a.id}
            className="mt-4 rounded-xl border border-[var(--line)] p-4"
          >
            <h3>
              {a.actor.fullName} · {stamp(a.createdAt)} · {label(a.kind)}
            </h3>
            {a.body && <p className="whitespace-pre-wrap">{a.body}</p>}
            <pre className="mt-3 whitespace-pre-wrap break-words text-xs">
              {JSON.stringify(a.changes, null, 2)}
            </pre>
          </article>
        ))}
        {!row.activities.length && <p>No staff activity recorded yet.</p>}
      </section>
    </>
  );
}
