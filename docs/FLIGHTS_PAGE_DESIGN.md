# Flights page redesign

Goal: make `/flights` the strongest page on the site: a search panel that feels as good as the best airline sites, and a page around it that explains why a human travel desk is worth using. Every claim on the page must match how air ticketing actually works (see `AIR_TICKETING.md`).

## Phases

- [x] **1. Search panel.** Custom calendar (range highlight, keyboard, bottom sheet on phones), airport search with flags and codes, travellers and cabin popover with steppers, trip type and option toggles.
- [x] **2. Page.** Full-bleed hero with the panel set into it, assurance row, "Departures from Kigali" board that fills the search, airline strip, how-it-works flight path, "a desk, not a fare bot" story, FAQ, cross-sell to transfers, stays and the city tour.
- [x] **3. Review and confirmation.** The itinerary as a boarding pass, contact step beside "what happens next", confirmation as an issued pass with the reference.
- [x] **4. Verification.** Typecheck, lint, unit tests, screenshots at 390 / 820 / 1280 / 1536, overflow check, keyboard pass through the panel.

## Claims kept out on purpose

- No airline schedules, flight times or "direct" claims: routes on the board are destinations people ask for, not services.
- No ticketing-partner or accreditation wording: still an open owner decision.
- No passport retention period: still to be confirmed with the partner.

## Status (2026-11-23)

All four phases are done and checked in headless Chrome at 390, 820, 1280 and 1536 px: no horizontal overflow, no console errors, board → calendar → review flow and keyboard calendar (arrows, Page Up/Down, Enter, Escape returns focus) verified. Typecheck, lint and the 52 flight tests pass.

Not yet seen in a browser: the confirmation pass after a real submission (it writes an enquiry, so it was left for a manual test).

## Where things are

| Piece | File |
| --- | --- |
| Page and its sections | `src/app/flights/page.tsx` |
| Search, review, confirmation | `src/components/booking/flight-enquiry-form.tsx` |
| Calendar, popover field, stepper | `src/components/booking/flight-search-controls.tsx` |
| Airport search (combobox) | `src/components/booking/flight-airport-input.tsx` |
| Departures board | `src/components/booking/flight-departures-board.tsx` |
| Board destinations, popular list | `src/lib/flight-destinations.ts` |

Design notes: the hero is a dark section, so `.search`, `.reviewGrid` and `.issued` restore the light tokens that `.on-dark` replaces. The hero must not get `isolate`, or the phone bottom sheets sit under the WhatsApp button and header.

## Route globe (2026-11-24)

The departures band is now the board beside a turning globe (`src/components/booking/flight-globe.tsx`, combined in `FlightRoutes` in `flight-departures-board.tsx`).

- Drawn on a canvas with no 3D library: land as a dot matrix, faint graticule, atmosphere, great-circle arcs from Kigali lifted by distance, planes along the routes of the region chosen on the board, pulsing markers and labels that avoid each other.
- The board's region lights its routes; the row under the pointer turns the globe to that route; clicking a city on the globe fills the search like the board. Drag turns it.
- Animates only while on screen and the tab is visible; holds still for reduced motion. Screen readers get a description; the board is the accessible way to choose.
- Land data: `src/data/globe-land-dots.json` (5,936 points, ~51 KB, loaded only with the globe), sampled every 1.35 degrees from Natural Earth land (public domain) as packaged by `world-atlas` 2.0.2 (land-50m). It was generated once; to regenerate, sample the land polygon on the same grid and write `[lon*10, lat*10, ...]`.
- Airport coordinates for the board's destinations and Kigali live in `src/lib/flight-destinations.ts`. Routes show destinations, not services: no airline or schedule is implied.

## Refinements (2026-11-24, second pass)

- **Flags, not codes.** Globe labels are a flag and the city; Kigali is a gold pill with the Rwandan flag. The board leads with a round flag and the city name, with "Country · CODE" small underneath. Airport codes stay only where travellers expect them: the search suggestions and the boarding-pass itinerary.
- **World traffic.** Faint aircraft fly 18 busy long-haul city pairs elsewhere in the world (no lines, no labels; 9 on small screens). Kigali's routes carry brighter aircraft along their gold arcs. Aircraft point the way they fly and leave a fading contrail.
- **Hero edge.** The hills ridgeline under the search promises is gone on this page; the hero runs into the globe band with a hairline seam.
- **Recent searches** (after Trip.com): the last three round-trip or one-way searches, kept in the visitor's browser only, shown inside the search panel and restored with one tap.

Trip.com could not be audited live: its flights page sends automated visitors to a verification check. The comparison was made from Trip.com's long-standing layout. Kept out on purpose: prices on destination cards and "deals" (public fares are an owner decision) and long link lists of popular routes (crowding).
