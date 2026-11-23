# Weddings page redesign

Brings `/weddings` up to the standard of `/flights` (see `FLIGHTS_PAGE_DESIGN.md`), reusing its calendar and popover fields.

## Done (2026-11-23)

- [x] **Hero with "Save the date".** Date (calendar), guests (dial with quick picks) and setting, then "Check this date" fills the request form and scrolls to it. Four assurances under it.
- [x] **Kinds of venue as photo cards.** Choosing one starts the request on the setting step with that kind chosen.
- [x] **Stepped request form** (`WeddingRequestForm`): The day → The setting → Your details, with a live summary line, per-step checks, Enter moving to the next step, and a server error returning to the step that holds the field. Confirmation styled as stationery with the reference.
- [x] **Checks.** Typecheck, lint, tests; desktop and phone flow in headless Chrome (checker → prefill → steps → venue card), no overflow or console errors.

The form posts exactly the fields the shared `ServiceEnquiryForm` posted for `journey=WEDDING`, to the same `submitServiceEnquiry` action, so the desk sees no change. The shared form is untouched and still serves every other page.

Not yet seen in a browser: the confirmation after a real submission (it writes an enquiry).

## Where things are

| Piece | File |
| --- | --- |
| Page | `src/app/weddings/page.tsx` |
| Hero checker, venue cards | `src/components/booking/wedding-date-checker.tsx` |
| Stepped request form, guest dial | `src/components/booking/wedding-request-form.tsx` |
| Styles | `src/components/booking/journey-form.module.css` (shared with Tembera) |
| Venue kinds, photos, locations, prefill event | `src/lib/wedding-request.ts` |

## Photographs

Kinds of venue use `lake-kivu-islands`, `kigali-marriott-ballroom`, `virunga-volcano` and `kigali-convention-centre-day`. The Marriott ballroom photo comes from the venue's own gallery (see `PHOTO_SOURCES.md`) and here illustrates "halls & ballrooms" in general; swap it for a Thrill photograph when there is one. The honeymoon story now uses `lake-kivu-fishermen`.
