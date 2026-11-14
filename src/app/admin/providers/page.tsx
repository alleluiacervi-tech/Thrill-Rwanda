import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { ActionButton } from "@/components/dashboard/action-button";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/primitives";
import { setProviderStatus } from "@/app/actions/admin";
import { ProviderCategories } from "@/components/dashboard/provider-categories";
import { TableSearch } from "@/components/dashboard/table-search";
import { providerKinds } from "@/lib/session";
import { searchTerm } from "@/lib/table-query";
import { Pagination } from "@/components/ui/pagination";
import { paginate } from "@/lib/pagination";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const KIND_LABEL = { CAR: "Car provider", HOTEL: "Hotel owner", TOUR: "Tour operator" } as const;

const TONE = {
  PENDING: "clay",
  VERIFIED: "forest",
  REJECTED: "outline",
  SUSPENDED: "ember",
} as const;

const STATUSES = new Set(["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"]);
const KINDS = new Set(["CAR", "HOTEL", "TOUR"]);

/**
 * One page, two filters, both driven by the sidebar.
 *
 * "Awaiting approval" and "Car hire" are the same table with a different
 * `where` — building them as separate routes would mean three copies of the
 * approve/reject controls to keep in step.
 */
export default async function AdminProvidersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/providers");

  const raw = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const statusParam = one(raw.status);
  const kindParam = one(raw.kind);
  const status = statusParam && STATUSES.has(statusParam) ? statusParam : "";
  const kind = kindParam && KINDS.has(kindParam) ? kindParam : "";

  const q = searchTerm(raw);

  const where = {
    ...(status ? { status: status as "PENDING" } : {}),
    ...(kind ? { kind: kind as "CAR" } : {}),
    ...(q
      ? {
          OR: [
            { businessName: { contains: q, mode: "insensitive" as const } },
            { city: { contains: q, mode: "insensitive" as const } },
            { user: { email: { contains: q, mode: "insensitive" as const } } },
            { user: { fullName: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const page = paginate(raw, await db.provider.count({ where }));

  const [providers, counts] = await Promise.all([
    db.provider.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: page.skip,
      take: page.take,
      include: {
        user: { select: { email: true, fullName: true, isActive: true } },
        _count: { select: { tours: true, hotels: true, vehicles: true, bookings: true } },
      },
    }),
    db.provider.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countOf = (s: string) =>
    counts.find((c) => c.status === s)?._count._all ?? 0;
  const total = counts.reduce((n, c) => n + c._count._all, 0);

  // Only one filter is offered at a time: the sidebar links to a status view
  // or a kind view, and showing both chip rows at once invites a combination
  // the sidebar can never highlight.
  const filtering = kind ? "kind" : "status";

  return (
    <>
      <DashboardHead
        title={
          kind
            ? `${KIND_LABEL[kind as keyof typeof KIND_LABEL]}s`
            : status
              ? `${status[0]}${status.slice(1).toLowerCase()} providers`
              : "Providers"
        }
        lede="Approve, reject and suspend. Approving grants the PROVIDER role; suspending or rejecting unpublishes every listing they have."
      />

      <TableSearch
        pathname="/admin/providers"
        placeholder="Search business, city or owner"
        className="mb-6"
      />

      {filtering === "status" ? (
        <FilterChips
          basePath="/admin/providers"
          param="status"
          current={status}
          label="Filter by approval status"
          chips={[
            { value: "", label: "All", count: total },
            { value: "PENDING", label: "Awaiting approval", count: countOf("PENDING") },
            { value: "VERIFIED", label: "Verified", count: countOf("VERIFIED") },
            { value: "REJECTED", label: "Rejected", count: countOf("REJECTED") },
            { value: "SUSPENDED", label: "Suspended", count: countOf("SUSPENDED") },
          ]}
        />
      ) : (
        <FilterChips
          basePath="/admin/providers"
          param="kind"
          current={kind}
          label="Filter by provider type"
          chips={[
            { value: "", label: "All", count: total },
            { value: "CAR", label: "Car hire" },
            { value: "HOTEL", label: "Hotel owners" },
            { value: "TOUR", label: "Tour operators" },
          ]}
        />
      )}

      {providers.length === 0 ? (
        <EmptyPanel
          title={status || kind ? "No providers match" : "No providers yet"}
          body={
            status || kind
              ? "Try another filter."
              : "Provider applications appear here."
          }
        />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Business</Th><Th>Contact</Th><Th className="text-right">Listings</Th>
              <Th className="text-right">Bookings</Th><Th>Status</Th>
              <Th className="text-right">May list</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => {
              const listings = p._count.tours + p._count.hotels + p._count.vehicles;
              return (
                <Tr key={p.id}>
                  <Td>
                    <span className="block font-medium">{p.businessName}</span>
                    <span className="block text-2xs text-[var(--ink-faint)]">
                      {KIND_LABEL[p.kind]}
                      {p.city ? ` · ${p.city}` : ""}
                    </span>
                    <span className="block text-2xs text-[var(--ink-faint)]">
                      {p.licenceNumber ? `Reg ${p.licenceNumber}` : "No registration on file"}
                      {p.kraPin ? ` · KRA ${p.kraPin}` : ""}
                    </span>
                  </Td>
                  <Td>
                    <span className="block truncate">{p.user.fullName}</span>
                    <span className="block truncate text-2xs text-[var(--ink-faint)]">{p.user.email}</span>
                  </Td>
                  <Td className="tnum text-right">{listings}</Td>
                  <Td className="tnum text-right">{p._count.bookings}</Td>
                  <Td><Badge tone={TONE[p.status]}>{p.status}</Badge></Td>
                  <Td>
                    <ProviderCategories
                      providerId={p.id}
                      kinds={providerKinds(p)}
                      businessName={p.businessName}
                    />
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-start gap-2">
                      {p.status !== "VERIFIED" && (
                        <ActionButton action={setProviderStatus} fields={{ providerId: p.id, status: "VERIFIED" }} variant="primary">
                          Approve
                        </ActionButton>
                      )}
                      {p.status === "PENDING" && (
                        <ActionButton action={setProviderStatus} fields={{ providerId: p.id, status: "REJECTED" }} variant="ghost" confirm="Confirm reject">
                          Reject
                        </ActionButton>
                      )}
                      {p.status === "VERIFIED" && (
                        <ActionButton action={setProviderStatus} fields={{ providerId: p.id, status: "SUSPENDED" }} variant="ghost" confirm="Confirm suspend">
                          Suspend
                        </ActionButton>
                      )}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </TableShell>
      )}

      <Pagination page={page} pathname="/admin/providers" params={raw} label="providers" />
    </>
  );
}
