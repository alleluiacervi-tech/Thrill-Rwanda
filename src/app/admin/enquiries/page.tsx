import Link from "next/link";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { Pagination } from "@/components/ui/pagination";
import { TableSearch } from "@/components/dashboard/table-search";
import { paginate } from "@/lib/pagination";
import { searchTerm } from "@/lib/table-query";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/enquiries");
  const params = await searchParams;
  const q = searchTerm(params);
  const where = q
    ? {
        OR: ["reference", "name", "phone", "email"].map((key) => ({
          [key]: { contains: q, mode: "insensitive" as const },
        })),
      }
    : {};
  const page = paginate(params, await db.enquiry.count({ where }));
  const enquiries = await db.enquiry.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: page.skip,
    take: page.take,
  });
  return (
    <>
      <DashboardHead
        title="Enquiries"
        lede="Saved flight requests. These are leads, not bookings. No seat is held and no payment is taken."
      />
      <TableSearch
        pathname="/admin/enquiries"
        placeholder="Reference, name, phone or email"
      />
      <TableShell>
        <thead>
          <tr>
            <Th>Reference</Th>
            <Th>Customer</Th>
            <Th>Reply channel</Th>
            <Th>Received</Th>
          </tr>
        </thead>
        <tbody>
          {enquiries.map((e) => (
            <Tr key={e.id}>
              <Td>
                <Link
                  href={`/admin/enquiries/${e.reference}`}
                  className="break-all underline"
                >
                  {e.reference}
                </Link>
              </Td>
              <Td>{e.name}</Td>
              <Td>{e.replyChannel.toLowerCase()}</Td>
              <Td>
                {e.createdAt.toLocaleString("en-GB", {
                  timeZone: "Africa/Kigali",
                })}
              </Td>
            </Tr>
          ))}
          {enquiries.length === 0 && (
            <Tr>
              <Td>No enquiries found.</Td>
              <Td />
              <Td />
              <Td />
            </Tr>
          )}
        </tbody>
      </TableShell>
      <Pagination
        page={page}
        pathname="/admin/enquiries"
        params={params}
        label="enquiries"
      />
    </>
  );
}
