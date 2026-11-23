# Tembera u Rwanda page redesign

Done 2026-11-24, following the flights and weddings pages.

- **Next departure ticket in the hero.** The soonest edition with places left: date, route, places left, the lowest all-inclusive price when trips are bookable online, and a link to book or to the editions.
- **Edition explorer** (`src/components/journey/editions-explorer.tsx`). Month filters with counts and a "Show my rate" switch (East African citizen, resident, non-resident) that changes the one price each card shows. Button wording and the interaction-counter attributes match the old `EditionCard`, which still exists for other pages.
- **"Be first to know" form** (`src/components/booking/tembera-request-form.tsx`). Public editions or a private edition, places (stepper), places of interest, months, rate, add-ons and contact. Months, rate and the kind of request are written into the enquiry message, so the desk reads them as one note; the enquiry is the same `journey=TEMBERA` / `service=TRIP` request as before.
- Styles shared with the weddings form live in `src/components/booking/journey-form.module.css`.

Checked: typecheck, lint, desktop and phone screenshots, rate switch and month filter. The confirmation after a real submission has not been seen in a browser.
