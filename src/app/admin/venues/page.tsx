import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { deleteVenue, setVenuePublished } from "@/app/actions/venues";
import { ActionButton } from "@/components/dashboard/action-button";
import { ConfirmDeleteButton } from "@/components/dashboard/confirm-delete-button";
import { DashboardHead, EmptyPanel } from "@/components/dashboard/dashboard-shell";
import { TableShell, Td, Th, Tr } from "@/components/dashboard/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { capacityLabel, publishBlocker } from "@/lib/venue-rules";

export const metadata = {
  title: "Wedding venues",
  robots: { index: false, follow: false },
};

export default async function AdminVenuesPage() {
  await requireAdmin("/admin/venues");

  const venues = await db.venue.findMany({ orderBy: [{ isPublished: "desc" }, { name: "asc" }] });
  const live = venues.filter((v) => v.isPublished).length;

  return (
    <>
      <DashboardHead
        title="Wedding venues"
        lede={`The venues shown on the Weddings & Events page. ${live} of ${venues.length} published. Venues carry no price: couples send a request and the date is confirmed by written quote.`}
        action={
          <Button href="/admin/venues/new" variant="accent">
            <Plus className="size-4" />
            Add venue
          </Button>
        }
      />

      {venues.length === 0 ? (
        <EmptyPanel
          title="No venues yet"
          body="Until a venue is published, the Weddings & Events page describes kinds of venue and takes requests. Add the venues Thrill Rwanda is able to reserve."
          action={
            <Button href="/admin/venues/new" variant="accent">
              <Plus className="size-4" />
              Add the first venue
            </Button>
          }
        />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Venue</Th>
              <Th>Kind</Th>
              <Th>Guests</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {venues.map((v) => {
              const blocker = publishBlocker(v);
              return (
                <Tr key={v.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-md bg-[var(--paper-sunken)]">
                        {v.images[0] ? (
                          <Image src={v.images[0]} alt="" fill sizes="44px" className="object-cover" />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium">{v.name}</span>
                        <span className="block text-2xs text-[var(--ink-faint)]">{v.location}</span>
                      </span>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">{v.kind}</Td>
                  <Td className="tnum whitespace-nowrap">{capacityLabel(v.capacity)}</Td>
                  <Td>
                    <Badge tone={v.isPublished ? "forest" : "outline"}>
                      {v.isPublished ? "Published" : "Draft"}
                    </Badge>
                    {!v.isPublished && blocker ? (
                      <span className="mt-1 block max-w-[14rem] text-2xs text-[var(--ink-faint)]">{blocker}</span>
                    ) : null}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-3 whitespace-nowrap">
                      <ActionButton
                        action={setVenuePublished}
                        fields={{ id: v.id, publish: v.isPublished ? "false" : "true" }}
                        variant={v.isPublished ? "ghost" : "primary"}
                      >
                        {v.isPublished ? "Hide" : "Publish"}
                      </ActionButton>
                      <Link href={`/admin/venues/${v.id}/edit`} className="link-draw text-2xs text-clay-700">
                        Edit
                      </Link>
                      <ConfirmDeleteButton
                        action={deleteVenue}
                        fields={{ id: v.id }}
                        title="Delete this venue?"
                        subject={`${v.name}, ${v.location}`}
                      >
                        <p>
                          It leaves the Weddings &amp; Events page straight away. Requests already
                          received keep their details.
                        </p>
                        <p>
                          To take it off the page for a while and bring it back later, use{" "}
                          <strong className="text-[var(--ink)]">Hide</strong> instead.
                        </p>
                      </ConfirmDeleteButton>
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </TableShell>
      )}
    </>
  );
}
