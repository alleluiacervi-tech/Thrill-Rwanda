import Link from "next/link";
import { ChevronRight, Mail, Phone } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { Monogram, Panel, StatGrid, StatTile, StatusPill, Toolbar } from "@/components/dashboard/dash-ui";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { TableSearch } from "@/components/dashboard/table-search";
import { Pagination } from "@/components/ui/pagination";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { CLOSED, enquiryScope, isFinance, label } from "@/lib/enquiry-workflow";
import { db } from "@/lib/db";
import { paginate, pageHref, PAGE_SIZE } from "@/lib/pagination";
import { one, searchTerm, type Params } from "@/lib/table-query";
import type { Prisma } from "@/generated/prisma/client";

const day = (d: Date) =>
  d.toLocaleDateString("en-GB", { timeZone: "Africa/Kigali", day: "numeric", month: "short", year: "numeric" });

export async function ClientDirectory({ params, base }: { params: Params; base: "/admin" | "/staff" }) {
  const actor = await requireEnquiryStaff();
  if (isFinance(actor)) redirect("/staff/enquiries");
  const scope = enquiryScope(actor);
  const path = `${base}/contacts`;
  const selected = one(params.contact);
  if (selected) {
    const contact = await db.enquiry.findFirst({
      where: { ...scope, reference: selected },
      select: { name: true, phone: true, email: true, contactKey: true },
    });
    if (!contact) notFound();
    const where = { ...scope, contactKey: contact.contactKey };
    const total = await db.enquiry.count({ where });
    const open = await db.enquiry.count({ where: { ...where, status: { notIn: CLOSED } } });
    const page = paginate(params, total);
    const cases = await db.enquiry.findMany({
      where, skip: page.skip, take: page.take, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { reference: true, service: true, status: true, createdAt: true, owner: { select: { fullName: true } } },
    });
    return <>
      <DashboardHead
        back={{ href: path, label: "All clients" }}
        title={contact.name}
        lede={[contact.email, contact.phone].filter(Boolean).join(" · ")}
      />
      <StatGrid cols={3}>
        <StatTile label="Enquiries" value={total} note="all time" />
        <StatTile label="Open" value={open} note="in progress" tone={open ? "alert" : "default"} />
        <StatTile label="Closed" value={total - open} note="completed or lost" />
      </StatGrid>
      <Panel title="Enquiry history" flush>
        <TableShell className="rounded-none border-0">
          <thead><tr><Th>Reference</Th><Th>Service</Th><Th>Stage</Th><Th>Owner</Th><Th>Received</Th></tr></thead>
          <tbody>{cases.map(item => (
            <Tr key={item.reference}>
              <Td className="whitespace-nowrap"><Link className="font-mono text-xs hover:underline" href={`${base}/enquiries/${item.reference}`}>{item.reference}</Link></Td>
              <Td>{label(item.service)}</Td>
              <Td><StatusPill tone={CLOSED.includes(item.status) ? "neutral" : "info"}>{label(item.status)}</StatusPill></Td>
              <Td>{item.owner?.fullName ?? <span className="text-[var(--ink-faint)]">Unassigned</span>}</Td>
              <Td className="whitespace-nowrap">{day(item.createdAt)}</Td>
            </Tr>
          ))}</tbody>
        </TableShell>
      </Panel>
      <Pagination page={page} pathname={path} params={params} label="enquiries" />
    </>;
  }
  const q = searchTerm(params);
  const match = { contains: q, mode: "insensitive" as const };
  const where: Prisma.EnquiryWhereInput = { AND: [scope, q ? { OR: [{ name: match }, { phone: match }, { email: match }, { reference: match }] } : {}] };
  const current = Math.max(1, Math.min(1_000_000, Number.parseInt(one(params.page), 10) || 1));
  const rows = await db.enquiry.groupBy({
    by: ["contactKey"], where, _count: { _all: true }, _max: { reference: true, createdAt: true, name: true, email: true, phone: true },
    orderBy: [{ _max: { createdAt: "desc" } }, { contactKey: "asc" }],
    skip: (current - 1) * PAGE_SIZE, take: PAGE_SIZE + 1,
  });
  const shown = rows.slice(0, PAGE_SIZE);
  return <>
    <DashboardHead title="Clients" lede="Everyone who has enquired, most recent first." />
    <Toolbar>
      <TableSearch className="sm:w-80" pathname={path} placeholder="Name, email, phone or reference" />
      {base === "/admin" && <Link className="ml-auto text-xs font-medium text-lake-700 underline" href={`/admin/bookings?${new URLSearchParams({ q })}`}>Search direct bookings instead</Link>}
    </Toolbar>
    {shown.length ? (
      <TableShell>
        <thead><tr><Th>Client</Th><Th>Contact</Th><Th>Enquiries</Th><Th>Last enquiry</Th><Th /></tr></thead>
        <tbody>{shown.map(row => {
          const href = `${path}?contact=${encodeURIComponent(row._max.reference!)}`;
          return (
            <Tr key={row._max.reference}>
              <Td><Link href={href} className="flex items-center gap-3"><Monogram name={row._max.name ?? ""} /><span className="font-medium">{row._max.name}</span></Link></Td>
              <Td>
                <span className="grid gap-0.5 text-xs text-[var(--ink-muted)]">
                  {row._max.email ? <span className="flex items-center gap-1.5"><Mail className="size-3" />{row._max.email}</span> : null}
                  {row._max.phone ? <span className="flex items-center gap-1.5"><Phone className="size-3" />{row._max.phone}</span> : null}
                </span>
              </Td>
              <Td className="tnum">{row._count._all}</Td>
              <Td className="whitespace-nowrap">{row._max.createdAt ? day(row._max.createdAt) : ""}</Td>
              <Td className="text-right"><Link href={href} aria-label={`Open ${row._max.name}`} className="text-[var(--ink-faint)] hover:text-[var(--ink)]"><ChevronRight className="inline size-4" /></Link></Td>
            </Tr>
          );
        })}</tbody>
      </TableShell>
    ) : <EmptyPanel title="No clients found" body={q ? "Nothing matches that search." : "Clients appear here once someone enquires."} />}
    <nav aria-label="Client pages" className="my-4 flex gap-4 text-sm">
      {current > 1 && <Link className="underline" href={pageHref(path, params, current - 1)}>Previous</Link>}
      {rows.length > PAGE_SIZE && <Link className="underline" href={pageHref(path, params, current + 1)}>Next</Link>}
    </nav>
  </>;
}
