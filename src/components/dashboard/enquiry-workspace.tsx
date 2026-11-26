import { AirlineLogo } from "@/components/booking/flight-marks";
import { AirportFlag } from "@/components/booking/airport-flag";
import { isAirlineCode } from "@/lib/flight-airlines";
import { CaseEmailForm } from "@/components/dashboard/case-email-form";
import { ClientAccessWorkspace } from "@/components/dashboard/client-access-workspace";
import { FinancialWorkspace } from "@/components/dashboard/financial-workspace";
import { QuoteWorkspace } from "@/components/dashboard/quote-workspace";
import { PaymentLinkForm } from "@/components/dashboard/payment-link-form";
import { canFinance } from "@/lib/finance-rules";
import { AIRPORT_TRANSFER_LABEL } from "@/lib/airport-transfer-pricing";
import { BusinessEventForm } from "@/components/dashboard/business-event-form";
import { businessEventSourcing, isBusinessEvent, milestoneKinds, milestoneStatuses, sourcingStatuses } from "@/lib/business-events";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Monogram, StatGrid, StatTile, StatusPill, Toolbar } from "@/components/dashboard/dash-ui";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
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
import { flightLegSchema, todayInRwanda } from "@/lib/flight-enquiry-schema";
import type { Prisma } from "@/generated/prisma/client";
import { ChangeSummary } from "@/components/dashboard/change-summary";

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
  const scope = enquiryScope(actor);
  const [matching, openCount, newCount, overdueCount, unassignedCount] = await Promise.all([
    db.enquiry.count({ where }),
    db.enquiry.count({ where: { AND: [scope, { status: { notIn: CLOSED } }] } }),
    db.enquiry.count({ where: { AND: [scope, { status: "NEW" }] } }),
    db.enquiry.count({
      where: { AND: [scope, { nextFollowUp: { lt: new Date() }, status: { notIn: CLOSED } }] },
    }),
    db.enquiry.count({
      where: { AND: [scope, { ownerId: null, status: { notIn: CLOSED } }] },
    }),
  ]);
  const page = paginate(params, matching);
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
  const now = new Date().getTime();
  const filtered = Boolean(q || status || value("service") || value("source") || value("owner") || value("due"));
  const select = (param: string, all: string, options: readonly { value: string; label: string }[]) => (
    <SelectFilter
      className="w-40"
      pathname={base}
      param={param}
      label={all}
      options={[{ value: "", label: all }, ...options]}
    />
  );
  return (
    <>
      <DashboardHead
        title="Enquiries"
        lede={
          finance
            ? "Financial milestone queue. Contact and travel details are restricted."
            : "Every lead, from first contact to confirmed trip."
        }
        action={
          !finance ? (
            <Button href={`${base}/new`} variant="accent">
              <Plus className="size-4" />
              New enquiry
            </Button>
          ) : undefined
        }
      />
      <StatGrid>
        <StatTile label="Open" value={openCount} note="in progress" href={base} />
        <StatTile label="New" value={newCount} note="not yet contacted" tone={newCount ? "alert" : "default"} href={`${base}?status=NEW`} />
        <StatTile label="Overdue" value={overdueCount} note="follow-up passed" tone={overdueCount ? "alert" : "good"} href={`${base}?due=overdue`} />
        <StatTile label="Unassigned" value={unassignedCount} note="no owner yet" href={`${base}?owner=unassigned`} />
      </StatGrid>
      <Toolbar>
        <TableSearch
          className="sm:w-72"
          pathname={base}
          placeholder={finance ? "Reference" : "Name, phone, email or reference"}
        />
        {select("status", "All statuses", ENQUIRY_STATUSES.map((s) => ({ value: s, label: label(s) })))}
        {select("service", "All services", SERVICES.map((s) => ({ value: s, label: label(s) })))}
        {select("source", "All sources", SOURCES.map((s) => ({ value: s, label: label(s) })))}
        {select("owner", "Any owner", [
          { value: "mine", label: "Assigned to me" },
          { value: "unassigned", label: "Unassigned" },
        ])}
        {select("due", "Any follow-up", [{ value: "overdue", label: "Overdue" }])}
        {filtered ? (
          <Link href={base} className="ml-auto text-xs font-medium text-lake-700 underline">
            Clear filters
          </Link>
        ) : null}
      </Toolbar>
      {rows.length ? (
        <TableShell>
          <thead>
            <tr>
              {!finance && <Th>Client</Th>}
              <Th>Reference</Th>
              <Th>Service</Th>
              <Th>Stage</Th>
              <Th>Owner</Th>
              <Th>Follow-up</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const overdue =
                row.nextFollowUp !== null && row.nextFollowUp.getTime() < now && !CLOSED.includes(row.status);
              return (
                <Tr key={row.reference}>
                  {!finance && (
                    <Td>
                      <Link className="flex items-center gap-3" href={`${base}/${row.reference}`}>
                        <Monogram name={row.name ?? ""} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{row.name}</span>
                          <span className="block text-2xs text-[var(--ink-faint)]">{label(row.source)}</span>
                        </span>
                      </Link>
                    </Td>
                  )}
                  <Td className="whitespace-nowrap">
                    <Link className="tnum font-mono text-xs hover:underline" href={`${base}/${row.reference}`}>
                      {row.reference}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">{label(row.service)}</Td>
                  <Td>
                    <StatusPill tone={statusTone(row.status)}>{label(row.status)}</StatusPill>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {row.owner?.fullName ?? <span className="text-[var(--ink-faint)]">Unassigned</span>}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {row.nextFollowUp ? (
                      <span className={overdue ? "font-medium text-clay-700" : ""}>
                        {row.nextFollowUp.toLocaleDateString("en-GB", {
                          timeZone: "Africa/Kigali",
                          day: "numeric",
                          month: "short",
                        })}
                        {overdue ? " · overdue" : ""}
                      </span>
                    ) : (
                      <span className="text-[var(--ink-faint)]">None set</span>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </TableShell>
      ) : (
        <EmptyPanel
          title={filtered ? "No enquiries match" : "No enquiries yet"}
          body={filtered ? "Try removing a filter or searching for something broader." : "New website, WhatsApp and phone enquiries will appear here."}
        />
      )}
      <Pagination page={page} pathname={base} params={params} label="enquiries" />
    </>
  );
}
const statusTone = (s: string): "neutral" | "good" | "warn" | "alert" | "info" =>
  s === "NEW" ? "alert"
  : ["CONFIRMED", "COMPLETED"].includes(s) ? "good"
  : ["QUOTE_SENT", "AWAITING_PAYMENT", "PARTNER_PROCESSING"].includes(s) ? "info"
  : s === "NEEDS_INFORMATION" ? "warn"
  : "neutral";
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
  const emailJobIds = row.activities.flatMap(activity => {
    const changes = activity.changes as { notificationId?: string } | null;
    return activity.kind === "EMAIL_QUEUED" && changes?.notificationId ? [changes.notificationId] : [];
  });
  const caseEmails = emailJobIds.length ? await db.notificationJob.findMany({
    where: { id: { in: emailJobIds }, enquiryId: row.id, kind: "STAFF_EMAIL" },
    select: { id: true, status: true, lastError: true },
  }) : [];
  // People named in the timeline's changes (owner changes), shown by name.
  const peopleIds = [
    ...new Set(
      row.activities.flatMap((a) =>
        JSON.stringify(a.changes ?? {}).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? [],
      ),
    ),
  ];
  const people = Object.fromEntries(
    (peopleIds.length
      ? await db.user.findMany({ where: { id: { in: peopleIds } }, select: { id: true, fullName: true } })
      : []
    ).map((u) => [u.id, u.fullName ?? "a team member"]),
  );
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
  const flightLegs = row.service === "FLIGHT" && details.tripType === "MULTI_CITY"
    ? [details, ...(Array.isArray(details.additionalLegs) ? details.additionalLegs : [])].flatMap(value => {
        const parsed = flightLegSchema.safeParse(value);
        return parsed.success ? [parsed.data] : [];
      }) : [];
  const businessEvent = !finance && isBusinessEvent(details);
  const paymentLink = canFinance(actor)
    ? await db.quoteAcceptance.findUnique({
        where: { enquiryId: row.id },
        select: { quote: { select: { currency: true, financialCase: { select: { paymentInvoice: { select: { link: true } } } } } } },
      })
    : null;
  const placeUrl = row.service === "TRANSPORT" && typeof details.transferPlaceId === "string"
    ? `https://www.google.com/maps/search/?${new URLSearchParams({
        api: "1",
        query: String(details.pickup === AIRPORT_TRANSFER_LABEL ? details.dropoff : details.pickup),
        query_place_id: details.transferPlaceId,
      })}`
    : undefined;
  const sourcing = businessEvent ? await businessEventSourcing(row.id) : [];
  const today = businessEvent ? todayInRwanda() : "";
  return (
    <>
      <Link href={base} className="underline">
        Back to enquiries
      </Link>
      {row.service === "FLIGHT" && (
        <p className="my-3">
          <Link href={`${base.replace("enquiries", "ticketing")}/${row.reference}`} className="inline-flex items-center gap-2 rounded-full bg-sun-500 px-4 py-1.5 text-sm font-semibold text-forest-950 hover:bg-sun-300">
            Air ticketing file
          </Link>
        </p>
      )}
      <DashboardHead
        title={businessEvent ? "Thrill Events & Business" : `${label(row.service)} enquiry`}
        lede={row.reference}
      />
      <p>
        {label(row.status)} · {row.owner?.fullName ?? "Unassigned"} · first
        response: {stamp(row.firstResponseAt)} · follow-up:{" "}
        {stamp(row.nextFollowUp)}
      </p>
      {!finance && (
        <>
          {flightLegs.length > 0 && <section className="mt-6">
            <h2 className="text-xl">Multi-city itinerary</h2>
            <ol className="mt-2 list-decimal space-y-2 pl-6">
              {flightLegs.map((leg, i) => <li key={i}><AirportFlag value={leg.origin} /> {leg.origin} → <AirportFlag value={leg.destination} /> {leg.destination} · {leg.departureDate}</li>)}
            </ol>
          </section>}
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            {row.service === "FLIGHT" && isAirlineCode(details.preferredAirline) && <div className="rounded-xl border border-[var(--line)] p-4">
              <dt className="text-sm">Preferred airline</dt>
              <dd className="mt-2"><AirlineLogo code={details.preferredAirline} /></dd>
            </div>}
            {[
              ["Customer", row.name],
              ["Phone / WhatsApp", row.phone || "Not supplied"],
              ["Email", row.email ?? "Not supplied"],
              ["Reply channel", label(row.replyChannel)],
              ["Source", label(row.source)],
              ["Received (Kigali)", stamp(row.createdAt)],
              ...(details.nonstopOnly === true ? [["Flight preference", "Nonstop only on every leg"]] : []),
              ...Object.entries(details)
                .filter(
                  ([key]) =>
                    !["name", "phone", "email", "replyChannel", "transferPlaceId", "nonstopOnly", "preferredAirline"].includes(key)
                    && !(flightLegs.length && ["origin", "destination", "departureDate", "tripType", "returnDate", "additionalLegs"].includes(key)),
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
            {placeUrl ? (
              <div className="rounded-xl border border-[var(--line)] p-4">
                <dt className="text-sm">Map location selected by customer</dt>
                <dd className="mt-2">
                  <a href={placeUrl} target="_blank" rel="noreferrer" className="underline">Open in Google Maps</a>
                </dd>
              </div>
            ) : null}
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
      {businessEvent && (
        <section className="mt-8 space-y-4">
          <h2 className="text-2xl">Venue sourcing and organizer milestones</h2>
          {sourcing.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {sourcing.map((entry) => {
                const option = entry.changes as {
                  venue: string;
                  hall?: string;
                  status: string;
                  holdUntil: string;
                  layout?: string;
                  capacity?: number;
                  facilities?: string;
                };
                const expired = option.status === "HELD" && option.holdUntil < today;
                return (
                  <li key={entry.id} className="rounded-xl border border-[var(--line)] p-4">
                    <h3 className="text-lg">{[option.venue, option.hall].filter(Boolean).join(" · ")}</h3>
                    <p>{expired ? "Hold expired" : label(option.status)} · checked {stamp(entry.createdAt)}</p>
                    {option.holdUntil && <p>Hold deadline · {option.holdUntil}</p>}
                    {(option.layout || option.capacity) && (
                      <p>{[option.layout, option.capacity && `${option.capacity} attendees`].filter(Boolean).join(" · ")}</p>
                    )}
                    {option.facilities && <p className="whitespace-pre-wrap break-words">{option.facilities}</p>}
                    <p className="mt-2 whitespace-pre-wrap break-words">{entry.body}</p>
                  </li>
                );
              })}
            </ul>
          )}
          {!CLOSED.includes(row.status) && (actor.role === "ADMIN" || row.ownerId === actor.id) && (
            <div className="grid gap-4 lg:grid-cols-2">
              <BusinessEventForm key={`source-${row.version}`} reference={row.reference} version={row.version} command="SOURCE" statuses={sourcingStatuses} />
              <BusinessEventForm key={`milestone-${row.version}`} reference={row.reference} version={row.version} command="MILESTONE" statuses={milestoneStatuses} milestones={milestoneKinds} />
            </div>
          )}
          <p>For the written proposal, include supplier-checked options, layout and capacity, itemized costs, inclusions and exclusions, hold deadlines, deposit and cancellation terms.</p>
        </section>
      )}
      {!finance && row.email && row.replyChannel === "EMAIL" && (actor.role === "ADMIN" || row.ownerId === actor.id) && (
        <CaseEmailForm reference={row.reference} version={row.version} email={row.email} />
      )}
      {!finance && <QuoteWorkspace enquiry={row} actor={actor} base={base} businessEvent={businessEvent} />}
      {!finance && <ClientAccessWorkspace reference={row.reference} />}
      <FinancialWorkspace enquiry={row} actor={actor} />
      {paymentLink ? (
        <PaymentLinkForm
          reference={row.reference}
          currency={paymentLink.quote.currency}
          expires={paymentLink.quote.financialCase?.paymentInvoice?.link?.expiresAt?.toLocaleString("en-GB", { timeZone: "Africa/Kigali" })}
          revoked={!!paymentLink.quote.financialCase?.paymentInvoice?.link?.revokedAt}
        />
      ) : null}
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
        {row.activities.map((a) => {
          const message = a.kind === "EMAIL_QUEUED" ? a.changes as { subject: string; notificationId: string } : null;
          const job = message && caseEmails.find(email => email.id === message.notificationId);
          return (
          <article
            key={a.id}
            className="mt-4 rounded-xl border border-[var(--line)] p-4"
          >
            <h3>
              {a.actor.fullName} · {stamp(a.createdAt)} · {label(a.kind)}
            </h3>
            {message && <p className="font-semibold">{message.subject}</p>}
            {job && <p>{job.status === "SENT" ? "Accepted by email provider" : label(job.status)}{job.lastError && ` · ${label(job.lastError)}`}</p>}
            {a.body && <p className="whitespace-pre-wrap">{a.body}</p>}
            {!message && <ChangeSummary changes={a.changes} names={people} />}
          </article>
          );
        })}
        {!row.activities.length && <p>No staff activity recorded yet.</p>}
      </section>
    </>
  );
}
