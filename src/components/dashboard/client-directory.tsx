import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { TableSearch } from "@/components/dashboard/table-search";
import { Pagination } from "@/components/ui/pagination";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { enquiryScope, isFinance, label } from "@/lib/enquiry-workflow";
import { db } from "@/lib/db";
import { paginate, pageHref, PAGE_SIZE } from "@/lib/pagination";
import { one, searchTerm, type Params } from "@/lib/table-query";
import type { Prisma } from "@/generated/prisma/client";

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
    const page = paginate(params, await db.enquiry.count({ where }));
    const cases = await db.enquiry.findMany({
      where, skip: page.skip, take: page.take, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { reference: true, service: true, status: true, createdAt: true, owner: { select: { fullName: true } } },
    });
    return <>
      <Link className="underline" href={path}>All clients</Link>
      <DashboardHead title={contact.name} lede={[contact.email, contact.phone].filter(Boolean).join(" · ")} />
      <h2 className="text-xl">Enquiry history</h2>
      <ul className="my-4 divide-y divide-[var(--line)]">{cases.map(item => (
        <li key={item.reference} className="py-3">
          <Link className="font-semibold underline" href={`${base}/enquiries/${item.reference}`}>{label(item.service)} · {label(item.status)}</Link>
          <p>{item.createdAt.toLocaleDateString("en-GB", { timeZone: "Africa/Kigali" })} · {item.owner?.fullName ?? "Unassigned"} · {item.reference}</p>
        </li>
      ))}</ul>
      <Pagination page={page} pathname={path} params={params} label="enquiries" />
    </>;
  }
  const q = searchTerm(params);
  const match = { contains: q, mode: "insensitive" as const };
  const where: Prisma.EnquiryWhereInput = { AND: [scope, q ? { OR: [{ name: match }, { phone: match }, { email: match }, { reference: match }] } : {}] };
  const current = Math.max(1, Math.min(1_000_000, Number.parseInt(one(params.page), 10) || 1));
  const rows = await db.enquiry.groupBy({
    by: ["contactKey"], where, _max: { reference: true, createdAt: true, name: true, email: true, phone: true },
    orderBy: [{ _max: { createdAt: "desc" } }, { contactKey: "asc" }],
    skip: (current - 1) * PAGE_SIZE, take: PAGE_SIZE + 1,
  });
  return <>
    <DashboardHead title="Clients" lede="Find enquiry contacts and open the cases your team can access." />
    <TableSearch pathname={path} placeholder="Name, email, phone or case reference" />
    {base === "/admin" && <Link className="my-3 inline-block underline" href={`/admin/bookings?${new URLSearchParams({ q })}`}>Search direct bookings</Link>}
    <ul className="my-4 divide-y divide-[var(--line)]">{rows.slice(0, PAGE_SIZE).map(row => (
      <li key={row._max.reference} className="py-3">
        <Link className="font-semibold underline" href={`${path}?contact=${encodeURIComponent(row._max.reference!)}`}>{row._max.name}</Link>
        <p>{[row._max.email, row._max.phone].filter(Boolean).join(" · ")}</p>
      </li>
    ))}</ul>
    {!rows.length && <p>No matching enquiry contacts.</p>}
    <nav aria-label="Client pages" className="my-4 flex gap-4">
      {current > 1 && <Link className="underline" href={pageHref(path, params, current - 1)}>Previous</Link>}
      {rows.length > PAGE_SIZE && <Link className="underline" href={pageHref(path, params, current + 1)}>Next</Link>}
    </nav>
  </>;
}
