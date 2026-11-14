import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/primitives";
import {
  revokeUserSessions,
  sendUserPasswordReset,
  setUserActive,
  setUserRole,
} from "@/app/actions/admin";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { RowMenu } from "@/components/dashboard/row-menu";
import { SortTh } from "@/components/dashboard/sort-header";
import { TableSearch } from "@/components/dashboard/table-search";
import { searchTerm, sortOrder } from "@/lib/table-query";
import { Pagination } from "@/components/ui/pagination";
import { paginate } from "@/lib/pagination";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

const ROLES = new Set(["CUSTOMER", "PROVIDER", "ADMIN"]);

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin("/admin/users");

  const params = await searchParams;
  const q = searchTerm(params);

  const roleParam = typeof params.role === "string" ? params.role : "";
  const role = ROLES.has(roleParam) ? (roleParam as "CUSTOMER" | "PROVIDER" | "ADMIN") : "";

  const search = q
    ? {
        OR: [
          { fullName: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const where = { ...search, ...(role ? { role } : {}) };

  const { orderBy, sort, dir } = sortOrder(
    params,
    [
      { value: "name", orderBy: { fullName: true } },
      { value: "joined", orderBy: { createdAt: true } },
      { value: "role", orderBy: { role: true } },
    ],
    [{ role: "asc" }, { createdAt: "desc" }],
  );
  const [page, roleCounts] = await Promise.all([
    db.user.count({ where }).then((total) => paginate(params, total)),
    db.user.groupBy({ by: ["role"], where: search, _count: { _all: true } }),
  ]);
  const countOf = (r: string) => roleCounts.find((c) => c.role === r)?._count._all ?? 0;

  const users = await db.user.findMany({
    where,
    orderBy,
    skip: page.skip,
    take: page.take,
    select: {
      id: true, email: true, fullName: true, phone: true, role: true,
      isActive: true, createdAt: true,
      _count: { select: { bookings: true } },
      provider: { select: { id: true } },
    },
  });

  return (
    <>
      <DashboardHead
        title="Users"
        lede="Customers, providers and admins. Deactivating keeps their records and bookings but blocks sign-in."
      />

      <TableSearch pathname="/admin/users" placeholder="Search name, email or phone" className="mb-4" />

      <FilterChips
        basePath="/admin/users"
        param="role"
        current={role}
        chips={[
          { value: "", label: "All", count: roleCounts.reduce((n, c) => n + c._count._all, 0) },
          { value: "CUSTOMER", label: "Customers", count: countOf("CUSTOMER") },
          { value: "PROVIDER", label: "Providers", count: countOf("PROVIDER") },
          { value: "ADMIN", label: "Admins", count: countOf("ADMIN") },
        ]}
        label="Filter by role"
        params={params}
      />

      {users.length === 0 ? (
        <EmptyPanel title="No users yet" body="Accounts appear here as people sign up." />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <SortTh value="name" pathname="/admin/users" params={params} active={sort} dir={dir}>
                Person
              </SortTh>
              <SortTh value="role" pathname="/admin/users" params={params} active={sort} dir={dir}>
                Role
              </SortTh>
              <Th className="text-right">Bookings</Th>
              <SortTh value="joined" pathname="/admin/users" params={params} active={sort} dir={dir}>
                Joined
              </SortTh>
              <Th>Account</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === admin.id;
              return (
                <Tr key={u.id}>
                  <Td>
                    <span className="block font-medium">
                      {u.fullName}
                      {isSelf ? (
                        <span className="ml-2 text-2xs font-normal text-[var(--ink-faint)]">(you)</span>
                      ) : null}
                    </span>
                    <span className="block max-w-[16rem] truncate text-2xs text-[var(--ink-faint)]">
                      {u.email}{u.phone ? ` · ${u.phone}` : ""}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={u.role === "ADMIN" ? "ember" : u.role === "PROVIDER" ? "forest" : "neutral"}>
                      {u.role}
                    </Badge>
                  </Td>
                  <Td className="tnum text-right">{u._count.bookings}</Td>
                  <Td className="tnum whitespace-nowrap text-2xs text-[var(--ink-muted)]">
                    {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(u.createdAt)}
                  </Td>
                  <Td>
                    <Badge tone={u.isActive ? "forest" : "outline"}>
                      {u.isActive ? "Active" : "Deactivated"}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <RowMenu
                      label={`Actions for ${u.fullName}`}
                      items={[
                        ...(isSelf
                          ? []
                          : [
                              {
                                label: u.isActive ? "Deactivate" : "Reactivate",
                                action: setUserActive,
                                fields: { userId: u.id, active: u.isActive ? "false" : "true" },
                                confirm: u.isActive ? "Confirm deactivate" : undefined,
                                danger: u.isActive,
                              },
                            ]),
                        {
                          label: "Send password reset",
                          action: sendUserPasswordReset,
                          fields: { userId: u.id },
                          confirm: "Send reset email",
                        },
                        ...(isSelf
                          ? []
                          : [
                              {
                                label: "Sign out everywhere",
                                action: revokeUserSessions,
                                fields: { userId: u.id },
                                confirm: "Confirm sign out",
                              },
                            ]),
                        // Role changes last: they are the rarest and the most consequential.
                        ...(isSelf || u.role === "PROVIDER"
                          ? []
                          : u.provider
                            ? [
                                {
                                  label: "Make provider",
                                  action: setUserRole,
                                  fields: { userId: u.id, role: "PROVIDER" },
                                  confirm: "Confirm make provider",
                                },
                              ]
                            : [{ label: "Make provider…", href: `/admin/users/${u.id}/provider` }]),
                        ...(isSelf
                          ? []
                          : u.role === "ADMIN"
                            ? [
                                {
                                  label: "Remove admin",
                                  action: setUserRole,
                                  fields: { userId: u.id, role: "CUSTOMER" },
                                  confirm: "Confirm demote",
                                  danger: true,
                                },
                              ]
                            : [
                                {
                                  label: "Make admin",
                                  action: setUserRole,
                                  fields: { userId: u.id, role: "ADMIN" },
                                  confirm: "Confirm make admin",
                                },
                              ]),
                      ]}
                    />
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </TableShell>
      )}

      <Pagination page={page} pathname="/admin/users" params={params} label="users" />
    </>
  );
}
