# Air ticketing

Thrill sells flights as a written quotation and issues tickets through a contracted ticketing partner. This module is the record of that last mile: fare options, travellers, partner evidence, e-ticket numbers, the itinerary and everything that happens after issue. It does not connect to an airline or GDS and does not issue tickets itself.

## Status

- [x] **Phase 1: ticketing desk and data model.** One file per flight enquiry with fare options, travellers, PNR, ticketing time limit, per-passenger ticket numbers and issuance evidence. Status path with hard gates. Queue with deadline countdowns.
- [x] **Phase 2: itinerary and delivery.** Boarding-pass style itinerary page, branded PDF, queued email, client trip page and manual delivery for clients who do not use email.
- [x] **Phase 3: post-ticket servicing.** Change, reissue, name correction, void and refund requests raised by the client or staff, with partner evidence, fees, ticket replacement history and a refund hand-off to Finance.
- [x] **Phase 4: design, privacy and quality.** Desk and case screens in the Thrill design system, 30-day passport retention job, audit trail, unit tests, a database integration check and a route check.

## Where things are

| Area | Location |
| --- | --- |
| Staff desk and case | `/staff/ticketing`, `/admin/ticketing` (and `/<reference>`) |
| Client trip page | `/account/enquiries/<reference>/trip` |
| Itinerary PDF | `/staff/ticketing/<reference>/itinerary`, `/account/enquiries/<reference>/trip/itinerary` |
| Rules (pure) | `src/lib/ticketing-rules.ts` |
| Database operations | `src/lib/ticketing.ts` |
| PDF | `src/lib/itinerary-pdf.ts`, `src/lib/ticketing-documents.ts` |
| Actions | `src/app/actions/ticketing.ts` |
| Screens | `src/components/ticketing/` |
| Schema | `FlightTicketing`, `FlightOption`, `FlightSegment`, `FlightPassenger`, `FlightServiceRequest` in `prisma/schema.prisma` |

## How a file moves

`Fare options → Awaiting payment → Ready to ticket → With ticketing partner → Issued → Closed`, or `Cancelled` before issue.

| Move | Rule |
| --- | --- |
| Options saved | At least one option; each needs a future validity time and flights in date order; names are unique. Saving clears any earlier "shared" state. |
| Fare chosen | By staff or by the client (only a client with accept rights, only after options are shared, only while the price is valid). One chosen fare per file, enforced by a partial unique index. |
| Awaiting payment | A chosen fare that is still valid. |
| Ready to ticket | **Verified funds cover the whole accepted quote**, every traveller is listed with date of birth and passport number, names are passport-style, ages match the traveller type, passports are valid for the trip, and the party matches the original request. |
| With partner | PNR, partner name and a future ticketing time limit. Funds are checked again. |
| Issued | A 13-digit ticket number for **every** traveller, none reused anywhere, plus written evidence of what the partner confirmed. Funds are checked again. Late issue after the time limit is recorded. |
| Closed | Only after the last flight has landed. |

Funds mean the case's ledger receipts plus verified online collections not yet settled, less refunds. A part payment never unlocks ticketing. Every change needs the file's current version, so two people cannot overwrite each other.

Who can do what: the case owner and administrators change a file. Other sales and operations staff cannot see it. Finance sees files once the enquiry has reached payment and never sees passport details. Customers see only their own trip and never see document numbers.

## After-sales

Requests are `Requested → Quoted → Approved → Completed` (or `Rejected` / `Withdrawn`). Completing needs the partner's confirmation. A refund needs the confirmed amount. A reissue needs the new ticket number for each traveller; the old number is kept in the traveller's history. A void or refund marks the traveller's ticket as voided or refunded. A change or reissue that is approved unlocks "Revise flights" for the chosen fare, which clears the delivered mark so the new itinerary is sent.

A completed refund is recorded on the file and the enquiry timeline. **Finance still settles the money to the client in Off-site finance**; the ticketing desk does not move money.

## Privacy

Passport number, passport expiry, date of birth and nationality are visible to the case team only and are never sent to clients or shown to Finance. `npm run ops:retention -- --apply` clears them 30 days after the last flight (and for cancelled files 30 days after cancellation), leaving names and ticket numbers. Without `--apply` it only reports. Deletion needs the same approval flag the document retention job already uses.

## Checks

- `npx vitest run src/lib/ticketing-rules src/lib/itinerary-pdf` for rules and the PDF.
- `npx tsx scripts/check-ticketing.ts` builds a disposable database and checks access, the funds gate, concurrency, issuing, duplicate ticket numbers, after-sales, the privacy boundary of the client view and retention.
- `npx tsx scripts/check-ticketing-routes.ts` with the local app running opens every screen as sales, finance, administrator, the client and a stranger, downloads the itinerary PDFs and removes its own fixtures.

## Open decisions for the owner

- **Ticketing partner and accreditation.** The partner name is recorded on each file. Disclosure wording on the flights page is unchanged and still needs the owner's decision.
- **Passport retention.** 30 days after the last flight is the default. Confirm with the partner and the privacy notice.
- **Ticketing fee.** Carried as an ordinary service-fee line on the quote. Nothing in this module adds a fee.
- **Partner automation.** Evidence is entered by hand. A partner or GDS feed is out of scope until commercial terms exist.
- **Refund hand-off.** Today a note on the case tells Finance. A structured refund obligation created from a completed refund request is a sensible next step once Finance agrees the wording.
