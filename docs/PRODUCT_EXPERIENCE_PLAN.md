# Product experience plan

How the owner's product list becomes one website. This is the living record:
what each phase delivers, what is done, and what is still open.

Status key: `[x]` done and verified · `[~]` in progress · `[ ]` not started

## The brief

The owner wants the site to sell, together:

1. Air ticketing
2. Tourism (tours and safaris)
3. Wedding hall reservations
4. Honeymoons for couples
5. Private and luxury tours across Rwanda
6. Kigali city tours
7. Group tours (schools and other organised groups)
8. Tembera u Rwanda: an all-inclusive campaign that Rwandans and foreign
   visitors pay for and book, covering food, hotels and everything needed for
   the days of the trip

## The shape

Eight products, five front doors, one travel desk, two ways to buy.

| Front door | Route | Products behind it | Service | How it is bought |
|---|---|---|---|---|
| Flights | `/flights` | Air ticketing | `FLIGHT` | Written quote |
| Tours & Experiences | `/experiences` | Private & luxury, honeymoons, Kigali city tour, safaris (`/tours`) | `TRIP` | Written quote; fixed-price offers can be booked |
| Tembera u Rwanda | `/tembera-urwanda` | The all-inclusive campaign | `TRIP` | Book and pay for a dated edition |
| Weddings & Events | `/weddings` | Wedding hall reservations, with honeymoon and guest travel | `EVENT` | Written quote, date checked by staff |
| Groups & Schools | `/groups` | School trips, associations, teams (`/corporate` stays for companies) | `GROUP` | Written quote |

Hotels, car hire and airport transfers remain live pages. They move out of the
headline menu into "Travel essentials", because they are ingredients of every
package rather than headline products.

Rules that hold everywhere:

- Every door obeys the publication switch in Admin → Launch. A hidden service
  disappears from the menu, the homepage, the sitemap and its own page.
- Nothing on a public page invents a price, a date, a venue or a response
  time. Offers, departures and venues appear only when they exist in the
  database and have been approved.
- Each door cross-sells the others (wedding → honeymoon → guest flights), and
  every request lands in the same enquiry and quote workflow.

## Phase 1: Front doors and navigation — done

No database changes.

- [x] Product content model (`src/lib/journeys.ts`): the five doors, the three
      collections, travel essentials and the cross-sell pairs, described once
- [x] Publication rules cover the new routes and pages nested under a door
      (`visiblePath` in `src/lib/launch-rules.ts`), with tests
- [x] Navigation: five doors in the header, an experiences panel (ways to
      travel, where to go, Tembera, travel essentials), the phone menu and
      the footer
- [x] Shared page sections (`src/components/journey/`): hero, "what we
      arrange", story, "goes well with", FAQ, request section
- [x] `/experiences` hub and `/experiences/[collection]` (private-luxury,
      honeymoon, kigali-city-tour)
- [x] `/weddings`
- [x] `/groups`, with a school-trips section; `/corporate` stays for companies
- [x] `/tembera-urwanda`
- [x] Homepage: five-door dock in the hero, ways to travel, the Tembera band,
      weddings and groups panels
- [x] Sitemap lists the new pages and drops them when their service is hidden
- [x] Verified: type-check, lint, 230 tests, every page returns 200, reviewed
      in a real browser at desktop and phone widths with no sideways scroll
      and no console errors; the experiences panel stays on screen at 1024px
      and 1280px

What Phase 1 left open, and where each was closed:

- The request form was still the general one. Closed in Phase 2.
- `/tembera-urwanda` had no dated editions. Closed in Phase 3.
- `/weddings` described kinds of venue only. Closed in Phase 4.
- The pages used stock photographs. Closed under Photography, below.

## Phase 2: Smart requests and collections — done

Migration: `20261116090000_tour_collections` (adds `tours.collection`).

- [x] Tours carry a collection, chosen in the tour form: safari, private &
      luxury, honeymoon, Kigali city tour, Tembera u Rwanda or school
- [x] Collection pages list their approved tours under "Ready-made", and
      `/tours` has a "Style" filter
- [x] Request form rebuilt (`src/components/booking/service-enquiry-form.tsx`):
      one form, tailored per journey by `src/lib/journey-requests.ts`
- [x] Wedding questions: what is being celebrated, kind of venue, what to
      arrange, guests expected, date and whether other dates would do
- [x] School and group questions: school or other group, students, teachers
      and staff, age group, subject of the visit. A school's total is added up
      for it.
- [x] "Add to this request": flights, transfers, accommodation, a honeymoon, a
      day in Kigali or a private tour, offered according to the journey and
      hidden when that service is hidden
- [x] Staff see the new answers in the enquiry workspace. Questions that were
      not asked are left off the record, so staff read only what was answered.
- [x] `/enquire?journey=HONEYMOON` (or any journey) opens the tailored form
- [x] Verified: schema and action tests (30 in those two files); a wedding
      request and a school request sent through a real browser and read back
      from the database; an invalid submission is refused and keeps what was
      typed

Also fixed while here: after a migration, a running dev server kept the old
database client until it was restarted, which is what caused the 500 errors
after earlier pulls. `src/lib/db.ts` now builds a new client when the
generated one changes.

## Phase 3: Tembera u Rwanda bookings — done

Migration: `20261116100000_tour_departures` (adds `tours.enquiry_only`,
`tours.fixed_departures` and the `tour_departures` table).

- [x] Dated departures. A departure is a first day on a tour that "runs on set
      dates only". Its seats are the tour's own capacity, held day by day in
      the existing availability calendar, so one inventory decides.
- [x] Quote or book is decided per offer: "Sold by written quote only" on the
      tour form keeps an offer request-only even while trips are switched to
      direct booking in Admin → Launch. Direct booking still needs that switch.
- [x] Admin and provider: a "Dates this tour runs" panel under the tour form.
      Adding or removing a date does not remove the offer's approval. Two runs
      of one tour cannot overlap; a date with bookings cannot be removed.
- [x] Public: `/tembera-urwanda` lists every upcoming edition with the date,
      seats left and, when bookable, the three resident rates. The homepage
      and the experiences hub show the next edition.
- [x] The booking panel on a dated tour offers the scheduled dates instead of
      free date fields, and caps guests at the seats left
- [x] The booking engine refuses any date that is not a departure, and any
      length other than the full run (`assertScheduledRun` in `src/lib/booking.ts`)
- [x] Verified end to end on the local database:
      a signed-in customer chose an edition on the Tembera page, booked three
      places and reached checkout with the 30% deposit, and that date dropped
      from 24 to 21 places; a doctored form asking for the day after a
      departure was refused by the server; a quote-only tour showed no booking
      form; the admin panel refused an overlap, added and removed a free date
      and refused to remove a booked one. `scripts/check-departures.ts` repeats
      the rule and seat checks against the database and is added to CI.

How to see it locally:

```
npm run db:seed:products               # files sample tours, adds two sample editions
npm run db:seed:products -- --direct   # also switches trips to direct booking
```

The script only runs against a local database and stamps what it writes as
demo data. The site picks up the switch within five minutes.

Known limits after Phase 3:

- Seats per departure equal the tour's "maximum group size". A date cannot
  have its own seat count.
- Seat counts on a tour page can be up to five minutes old (the page is
  cached). The Tembera page is always live, and the server decides at booking.
- Online card and mobile-money payment is still "being switched on" at
  checkout (existing behaviour): the customer confirms and staff take payment
  by phone or WhatsApp.

## Phase 4: Venue catalogue — done

Migration: `20261116110000_venues` (adds the `venues` table).

- [x] Venue records: name, kind, town or area, guests it takes, description,
      "good to know" facts and photographs. No price and no calendar: a venue
      is reserved on the customer's behalf after a written quote.
- [x] Admin → Wedding venues: add, edit, publish, hide and delete. A venue is
      saved as a draft and can be published only once it has a photograph and
      a description. Admin only: venues are Thrill Rwanda's list, not a
      provider's listing.
- [x] `/weddings` lists published venues, largest first. Each card opens the
      request form for that venue, with the kind and place filled in and the
      venue named in the request staff receive. With no venue published, the
      page falls back to describing kinds of venue.
- [x] Verified in a real browser as an administrator and then as a visitor:
      an incomplete venue was refused with each field named; a complete one
      was saved as a draft and stayed off the public page; publishing without
      a photograph was refused; after adding one it was published, appeared on
      `/weddings`, and a request sent from its card arrived naming the venue;
      hiding removed it again. 13 unit tests cover the rules.

Known limits after Phase 4:

- A venue has no page of its own, only a card. Add one when there are enough
  photographs per venue to fill it.
- The date is checked by staff with the venue. There is no venue calendar, by
  design, until Thrill Rwanda holds venues' diaries.

## Phase 5: Brief compliance, access control and analytics — done

From a check of the build against the Version 2.0 brief (15 November 2026),
and the owner's requests of 18 November 2026.

Brief compliance
- [x] Homepage service cards say how each service is bought (brief §4.3):
      "Written quote", "Book a dated edition", "Quote or book online".
- [x] Phone and WhatsApp reachable from the header on phones (brief §4.1):
      a call button in the header, and call, WhatsApp, sign-in and flight
      quote pinned to the bottom of the phone menu.
- [x] Admin → Settings switch for the moving hero, so the founder can decide
      on autoplay video without a developer (brief §11). Off also stops the
      reels pre-downloading their clips.
- [x] Quotations download as PDF (brief §7, §17), for staff and customers.
      `?format=html` still gives the printable web copy.
- [x] Sign-in and sign-up claims rewritten so the site promises only what it
      does today (no held funds, no fixed cancellation window, no timelines).

Access and accountability
- [x] Super admin: full access, and the only role that can grant or remove
      access (administrator, super admin, staff roles, provider, deactivation,
      two-step reset). At least one active super admin always remains; nobody
      can remove their own super admin access. Other administrators run the
      business read-only on access. Rules live in `src/lib/access.ts`, tested.
- [x] Activity log (Admin → Activity log, super admins only): every change by
      administrators, staff and providers, and every team sign-in, with the
      person's name, email, access and IP at the time. Append-only: a
      database trigger refuses any edit or deletion. Filter by person, area,
      date and text; export to CSV (the export is itself logged).
- [x] Two-step sign-in for administrators and staff (brief §12): scan a QR
      code with any authenticator app, ten single-use backup codes, and
      "trust this device for 30 days". Team members are sent to
      Account → Sign-in security until it is on, and cannot switch it off.
      A super admin can reset it for someone who lost their phone. Set
      `TEAM_TWO_FACTOR=optional` only for local development.

Analytics and experience
- [x] Admin → Overview is an analytics dashboard (brief §10.1): date presets
      or a custom range compared with the period before; requests per day,
      the request funnel, service mix, sources, open requests by owner,
      overdue work, money recorded by currency, website buttons pressed,
      Tembera seats and online bookings.
- [x] Phone menu rebuilt: opens in 200 ms, scrolls only inside, fits 360 px
      phones, actions fixed at the bottom.
- [x] Full audit: 32 public pages and 43 dashboard pages at phone and desktop
      widths, with no sideways scrolling, one heading per page and every
      field labelled.
- [x] Verified, committed, merged and deployed

Demo data: `npm run db:seed:demo` adds a super admin (admin@), an ordinary
administrator (manager@) and sales, operations and finance staff.
`npm run db:seed:products -- --activity` adds 90 days of sample requests
so the dashboard has something to show. Both refuse a hosted database
unless `DEMO_DATABASE_HOST` names it.

## Photography

The new pages now use real photographs of Rwanda: Thrill Rwanda's own, and
Visit Rwanda's, which the owner confirmed may be used. `docs/PHOTO_SOURCES.md`
lists every file, where it came from, what is still a stock stand-in (hotels,
vehicles, one lodge interior) and three points to confirm with Visit Rwanda.

## Running it

```
npm run db:deploy                      # applies all migrations
npm run db:seed:products -- --direct   # local only: sample tours, editions, venues, and booking switched on
npm run dev
```

Checks: `npm run typecheck`, `npm run lint`, `npm test` (280 tests), and
`npx tsx scripts/check-departures.ts` against the local database. The last is
also in the CI workflow.

What an administrator does to go live with each product:

| Product | Where | Steps |
|---|---|---|
| A collection (private, honeymoon, city tour) | Admin → Listings → a tour | Choose its collection; tick "Sold by written quote only" if it should never be booked directly; approve it in Admin → Launch |
| A Tembera u Rwanda edition | Admin → Listings → a tour | Collection "Tembera u Rwanda"; tick "Runs on set dates only"; save; add dates under the form; approve it in Admin → Launch |
| Booking and payment for editions | Admin → Launch | Switch Trips to direct booking, with approval evidence |
| A wedding venue | Admin → Wedding venues | Add it, attach a photograph, publish |
| Hiding a door | Admin → Launch | Set its service to hidden: it leaves the menu, the homepage, the sitemap and its page |

## Decisions needed from the owner

| Question | Why it matters | Working assumption until answered |
|---|---|---|
| Does Thrill have permission to sell under the name "Tembera u Rwanda"? It is also the name of the Rwanda Development Board's domestic tourism campaign. | Legal and brand risk | The name is used as the owner asked. It lives in one constant (`TEMBERA` in `src/lib/journeys.ts`), so it can be changed in one place. |
| Is Tembera paid in full online, or as a deposit? | Checkout wording and cash flow | The existing deposit setting in Admin → Settings applies (30% locally). |
| Which venues is Thrill able to reserve? | The venue catalogue is empty until they are added | Only sample venues exist, in local demo data. |
| Is ticketing done under Thrill's own accreditation or through a partner? | Disclosure wording on the flights page | Unchanged from the current flights page. |
| Three photograph points for Visit Rwanda (see `docs/PHOTO_SOURCES.md`) | Rights | The photographs are in use on the owner's confirmation. |

## Progress log

- **Phase 1 complete.** Five front doors live on the local site: flights,
  tours and experiences (with three collections), Tembera u Rwanda, weddings
  and events, groups and schools. The homepage, header, phone menu, footer
  and sitemap all read from one product map.
- **Phase 2 complete.** Each door now asks its own questions, and tours can be
  filed under collections.
- **Phase 3 complete.** Tembera u Rwanda editions can be scheduled, listed,
  booked and paid for through the existing checkout.
- **Phase 4 complete.** Wedding venues can be added, published and requested.
- **Photography.** Sixteen Visit Rwanda photographs replace stock pictures
  across the new pages, the destinations and the sample tours.
- **Phase 5 complete.** Super admin and an append-only activity log, two-step
  sign-in with trusted devices, an analytics dashboard, PDF quotations, a
  rebuilt phone menu and a full responsive and accessibility audit.
