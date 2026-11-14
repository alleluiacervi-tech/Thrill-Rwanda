import Link from "next/link";
import { Plus } from "lucide-react";
import { deleteTransferZone, setTransferZoneActive } from "@/app/actions/transfers";
import { ActionButton } from "@/components/dashboard/action-button";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { NIGHT_PERCENT, ORIGIN_LABEL, TRANSFER_ORIGINS } from "@/lib/transfer-zones-shared";
import { formatMoney } from "@/lib/utils";

export const metadata = {
  title: "Transfer zones",
  robots: { index: false, follow: false },
};

export default async function AdminTransfersPage() {
  await requireAdmin("/admin/transfers");

  // Every zone on one page: around 25 rows, and the price lists read best whole.
  const zones = await db.transferZone.findMany({ orderBy: [{ origin: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] });
  const live = zones.filter((z) => z.isActive).length;

  return (
    <>
      <DashboardHead
        title="Transfer zones"
        lede={`Fixed prices per vehicle, by area. ${live} of ${zones.length} bookable. Night trips (9pm–5am) add ${NIGHT_PERCENT}%, automatically.`}
        action={
          <Button href="/admin/transfers/new" variant="accent">
            <Plus className="size-4" />
            Add zone
          </Button>
        }
      />

      {zones.length === 0 ? (
        <EmptyPanel
          title="No transfer zones yet"
          body="Add the areas you serve and what each vehicle costs. Customers can book them as soon as they are saved."
          action={
            <Button href="/admin/transfers/new" variant="accent">
              <Plus className="size-4" />
              Add the first zone
            </Button>
          }
        />
      ) : (
        <div className="space-y-10">
          {TRANSFER_ORIGINS.map((origin) => {
            const rows = zones.filter((z) => z.origin === origin);
            if (rows.length === 0) return null;
            return (
              <section key={origin}>
                <h2 className="mb-3 text-lg">{ORIGIN_LABEL[origin]}</h2>
                <TableShell>
                  <thead>
                    <tr>
                      <Th>Zone</Th>
                      <Th>Areas</Th>
                      <Th className="text-right">Sedan</Th>
                      <Th className="text-right">Van</Th>
                      <Th className="text-right">Prado</Th>
                      <Th>Status</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((z) => (
                      <Tr key={z.id}>
                        <Td className="whitespace-nowrap font-medium">
                          {z.name}
                          {z.distance ? <span className="block text-2xs font-normal text-[var(--ink-faint)]">{z.distance}</span> : null}
                        </Td>
                        <Td>
                          <span className="line-clamp-2 max-w-[24rem] text-2xs text-[var(--ink-muted)]">{z.areas}</span>
                        </Td>
                        <Td className="tnum whitespace-nowrap text-right font-medium">{formatMoney(z.sedanMinor)}</Td>
                        <Td className="tnum whitespace-nowrap text-right">{formatMoney(z.vanMinor)}</Td>
                        <Td className="tnum whitespace-nowrap text-right">{formatMoney(z.premiumMinor)}</Td>
                        <Td>
                          <Badge tone={z.isActive ? "forest" : "outline"}>{z.isActive ? "Live" : "Hidden"}</Badge>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-3 whitespace-nowrap">
                            <ActionButton
                              action={setTransferZoneActive}
                              fields={{ id: z.id, active: z.isActive ? "false" : "true" }}
                              variant={z.isActive ? "ghost" : "primary"}
                            >
                              {z.isActive ? "Hide" : "Show"}
                            </ActionButton>
                            <Link href={`/admin/transfers/${z.id}/edit`} className="link-draw text-2xs text-clay-700">
                              Edit
                            </Link>
                            <ConfirmDeleteButton
                              action={deleteTransferZone}
                              fields={{ id: z.id }}
                              title="Delete this zone?"
                              subject={`${z.name}: ${z.areas}`}
                            >
                              <p>Its areas stop being bookable straight away. Existing bookings keep their price.</p>
                              <p>
                                To take it off the site for a while and bring it back later, use{" "}
                                <strong className="text-[var(--ink)]">Hide</strong> instead.
                              </p>
                            </ConfirmDeleteButton>
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </TableShell>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
