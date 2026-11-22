import Image from "next/image";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, SectionHead } from "@/components/ui/primitives";
import { filterMeetingSpaces, layouts, meetingCapacity, spaceTypes, type MeetingSpace, type MeetingVenue } from "@/lib/meeting-directory";

type Search = Record<string, string | string[] | undefined>;
const single = (value: Search[string]) => typeof value === "string" ? value : "";
const field = "mt-1.5 block w-full rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-2.5";

export function MeetingDirectory({ search, catalogue }: {
  search: Search;
  catalogue: { venues: MeetingVenue[]; spaces: MeetingSpace[] };
}) {
  const { venues: meetingVenues } = catalogue;
  const query = single(search.q).trim().slice(0, 120);
  const venue = meetingVenues.find((item) => item.slug === search.property)?.slug ?? "";
  const type = spaceTypes.find((item) => item === search.type) ?? "";
  const layout = layouts.find((item) => item === search.layout);
  const count = single(search.attendees);
  const attendees = /^\d{1,5}$/.test(count) ? Math.min(Number(count), 10000) : 0;
  const filtered = Boolean(query || venue || type || layout || attendees);
  const spaces = filterMeetingSpaces({ venue, query, type, layout, attendees }, catalogue);
  const compare = [search.compare].flat().filter((value): value is string => typeof value === "string");
  const matches = spaces.filter((space) => compare.includes(`${space.venue}/${space.id}`));
  const selected = matches.slice(0, 4);
  const number = new Intl.NumberFormat("en-RW");

  return (
    <Container wide id="venues" className="scroll-mt-28 pb-12 sm:pb-16">
      <SectionHead
        title="Find a meeting space in Kigali"
        lede="Explore hotel ballrooms, convention halls, boardrooms and outdoor spaces. Thrill checks rates, room setup and availability for your dates."
      />
      <form action="/events-business#venues" method="get" className="mt-7 grid gap-4 rounded-2xl border border-[var(--line)] p-5 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-sm font-semibold">
          Venue or room name
          <input className={field} name="q" defaultValue={query} maxLength={120} placeholder="e.g. Kilimanjaro" />
        </label>
        <label className="text-sm font-semibold">
          Property
          <select className={field} name="property" defaultValue={venue}>
            <option value="">Any property</option>
            {meetingVenues.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Space type
          <select className={field} name="type" defaultValue={type}>
            <option value="">Any space</option>
            {spaceTypes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Seating layout
          <select className={field} name="layout" defaultValue={layout ?? ""}>
            <option value="">Any layout</option>
            {layouts.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Attendees
          <input className={field} name="attendees" defaultValue={attendees || ""} type="number" min={1} max={10000} placeholder="e.g. 80" />
        </label>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2 xl:col-span-5">
          <Button type="submit">Find spaces</Button>
          {filtered && <Link href="/events-business#venues" className="underline underline-offset-4">Clear filters</Link>}
        </div>
      </form>

      <p className="mt-5 text-sm" role="status">
        {number.format(spaces.length)} {spaces.length === 1 ? "space" : "spaces"}
        {filtered && " matching your filters"}
        {layout || attendees ? ". Results use published capacities." : "."}
      </p>
      {!spaces.length && (
        <p className="mt-3">Try different filters or <Link href="#request" className="underline">tell us what you need</Link> and we can check other spaces.</p>
      )}
      {spaces.length > 0 && (
        <form id="compare-spaces" action="/events-business#comparison" method="get" className="mt-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="q" value={query} />
          <input type="hidden" name="property" value={venue} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="layout" value={layout ?? ""} />
          <input type="hidden" name="attendees" value={attendees || ""} />
          <Button variant="outline" size="sm" type="submit" name="showComparison" value="yes">Compare selected spaces</Button>
          <span className="text-sm">Tick up to four rooms in the results.</span>
        </form>
      )}
      {search.showComparison === "yes" && (
        <section id="comparison" className="mt-6 scroll-mt-28 rounded-2xl border border-[var(--line)] p-5">
          <h3 className="text-xl">Compare room layouts</h3>
          {matches.length > 4 && <p className="mt-3">Showing four of the selected spaces.</p>}
          {selected.length < 2 ? (
            <p className="mt-3">Select at least two spaces below to compare them.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)]">
                    <th scope="col" className="p-2">Layout</th>
                    {selected.map((space) => (
                      <th key={`${space.venue}/${space.id}`} scope="col" className="p-2">
                        {space.name}
                        <span className="block font-normal">{meetingVenues.find((item) => item.slug === space.venue)?.name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {layouts.map((item) => (
                    <tr key={item} className="border-b border-[var(--line)]">
                      <th scope="row" className="p-2">{item}</th>
                      {selected.map((space) => (
                        <td key={`${space.venue}/${space.id}`} className="p-2">
                          {space.capacities[item]?.toLocaleString("en-RW") ?? "Ask venue"}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className="p-2">Published maximum</th>
                    {selected.map((space) => (
                      <td key={`${space.venue}/${space.id}`} className="p-2">
                        {meetingCapacity(space) ? number.format(meetingCapacity(space)) : "Ask venue"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {meetingVenues.map((property) => {
          const rooms = spaces.filter((space) => space.venue === property.slug);
          if (!rooms.length) return null;
          return (
            <article key={property.slug} className="self-start overflow-hidden rounded-2xl border border-[var(--line)]">
              {property.image && (
                <div className="relative aspect-[2/1] bg-forest-950">
                  <Image src={property.image} alt={property.imageAlt ?? property.name} fill className="object-cover" unoptimized={property.image.startsWith("https://")}
                    sizes="(max-width: 1023px) calc(100vw - 40px), (max-width: 1760px) 50vw, 840px" />
                </div>
              )}
              <div className="p-5 sm:p-6">
                <p className="flex items-center gap-2 text-sm">
                  <Building2 className="size-4" aria-hidden /> {property.kind}
                </p>
                <h3 className="mt-2 text-2xl">{property.name}</h3>
                <p className="mt-2">{property.description}</p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <Link href={`/events-business?venue=${property.slug}#request`} aria-label={`Enquire about ${property.name}`} className="underline underline-offset-4">
                    Enquire about this property
                  </Link>
                  {property.source && (
                    <a href={property.source} aria-label={`Venue information for ${property.name}`} className="underline underline-offset-4">
                      Venue information
                    </a>
                  )}
                </div>
                <details open={(filtered || rooms.some((space) => selected.includes(space))) || undefined} className="mt-5 border-t border-[var(--line)] pt-4">
                  <summary className="cursor-pointer font-semibold">
                    View {rooms.length} {rooms.length === 1 ? "space" : "spaces"}
                  </summary>
                  <ul className="mt-3 divide-y divide-[var(--line)]">
                    {rooms.map((space) => (
                      <li key={space.id} className="py-4">
                        <h4 className="font-semibold">{space.name}</h4>
                        <p className="mt-1 text-sm">{space.type}</p>
                        {space.features && <p className="mt-2 whitespace-pre-wrap text-sm">{space.features}</p>}
                        {Object.keys(space.capacities).length ? (
                          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                            {layouts.map((item) => space.capacities[item] && (
                              <div key={item} className={item === layout ? "font-semibold" : undefined}>
                                <dt className="inline">{item} </dt>
                                <dd className="inline tabular-nums">{number.format(space.capacities[item]!)}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p className="mt-2 text-sm">
                            {space.publishedMaximum ? `Published maximum ${number.format(space.publishedMaximum)}` : "Ask for layout and capacity"}
                          </p>
                        )}
                        <Link
                          href={`/events-business?${new URLSearchParams({ venue: property.slug, room: space.id, ...(attendees ? { attendees: String(attendees) } : {}), ...(layout ? { layout } : {}) })}#request`}
                          aria-label={`Enquire about ${space.name} at ${property.name}`}
                          className="mt-2 inline-block text-sm font-semibold underline underline-offset-4"
                        >
                          Enquire about this space
                        </Link>
                        <label className="ml-4 inline-flex items-center gap-2 text-sm">
                          <input form="compare-spaces" type="checkbox" name="compare" value={`${space.venue}/${space.id}`} defaultChecked={selected.includes(space)} />
                          Compare <span className="sr-only">{space.name} at {property.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </article>
          );
        })}
      </div>
    </Container>
  );
}
