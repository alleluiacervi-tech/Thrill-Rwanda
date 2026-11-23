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
