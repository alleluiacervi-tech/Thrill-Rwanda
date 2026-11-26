# Online flight booking (Duffel)

Travellers search, choose a real fare, enter traveller details, pay and receive their e-ticket on thrillrwanda.com, without waiting for the desk.

## How it fits what exists

A purchase made online creates the same records a desk sale does, so nothing downstream changes:

`Enquiry (FLIGHT, source ONLINE) → written quote (fare + service fee) → acceptance by the traveller → financial case → invoice and payment link (/pay) → verified funds → ticketing file READY_TO_TICKET → Duffel order → tickets issued → itinerary emailed`

The desk sees every online booking in its queue, Finance sees the money the usual way, and after-sales (changes, refunds) runs through the existing ticketing screens. The funds gate is unchanged: nothing is bought from Duffel until the traveller's payment is verified.

## Prerequisites from the owner

| Need | Why | Status |
| --- | --- | --- |
| Duffel **test** token (`duffel_test_…`, free, Duffel dashboard → Developers → Access tokens) | Builds and checks every step with sandbox airlines; no money moves | Needed now |
| Duffel **live** account approved, balance funded, `DUFFEL_ALLOW_LIVE=true` | Real tickets; Duffel charges the balance per booking | Owner, later |
| UrubutoPay merchant credentials and online payment switched on | Travellers pay on the site | Owner, pending |
| Service fee per booking | Your margin on each ticket | Owner decision (Admin setting, Phase 4) |

## Phases

- [x] **Phase 1: search and results.** `/flights/book` searches Duffel live (one way or return, travellers, cabin), shows real fares with airline, times, stops, duration, baggage and change/refund rules, sorted by price. Choosing one re-prices it with the airline and shows the fare page. Searches are rate limited per visitor and cached briefly. Sandbox fares are shown only to staff, with a preview note listing what still blocks travellers.
- [x] **Phase 2: travellers and checkout.** Passport-style names, date of birth, gender, passport details for every traveller (the desk's ticketing rules need them), contact email and phone. One transaction creates the enquiry, quote, acceptance, ticketing file with the chosen Duffel fare and travellers, financial case, invoice and payment link, then sends the traveller to `/pay`. Where the airline allows, a Duffel hold order guarantees the price while the traveller pays.
- [x] **Phase 3: automatic ticketing.** A worker job picks up paid online bookings, re-checks the fare, books (or pays the hold) with Duffel, records ticket numbers, moves the file to Issued and emails the itinerary. A price change, expiry or Duffel failure stops and alerts the desk with a clear next step (rebook or refund); nothing is retried blindly.
- [~] **Phase 4: controls and launch.** Done: Admin switch, rate, buffer, fee and owner with readiness checks; desk "Pay held booking" and stop notices; `/flights` search goes to live fares when open. Left: an end-to-end run against Duffel's real sandbox, auto-cancelling unpaid bookings after their deadline, a customer "payment received, ticket on its way" email, a Duffel balance warning and a desk queue filter for online bookings.

## Log

- 2026-11-26: Plan written. Owner chose Duffel for on-site booking.
- 2026-11-26: Phases 1 to 3 built and most of Phase 4.
  - **Code:** `src/lib/flight-shop-rules.ts` (search, pricing, checkout input, tested), `src/lib/flight-shop.ts` (availability, search, re-pricing), `src/lib/flight-checkout.ts` (records + Duffel hold), `src/lib/flight-autoticket.ts` and `/api/cron/online-ticketing` every 2 minutes, `payHeldBooking` in `src/lib/ticketing-duffel.ts`, pages `/flights/book` and `/flights/book/[offer]`.
  - **Settings:** migration `20261126090000_flight_online` (additive): switch, USD→RWF rate and when set, buffer %, fee per traveller, desk owner. A rate older than 72 hours pauses booking.
  - **Pricing:** Duffel USD × rate × (1 + buffer), rounded up to 100 RWF, plus the fee per traveller; travellers pay in RWF through UrubutoPay.
  - **Verified locally** against a mock Duffel API in the running app (Chrome at 1280 and 390 px): results, fare page, traveller form, payment page; then a simulated verified payment and the worker: a held fare was paid once and ticketed, an instant fare was booked once and ticketed, a fare whose price rose stopped for the desk and was not retried. Itinerary emails queued. Test records removed afterwards. Typecheck, lint and 453 unit tests pass.
  - **Not yet seen:** Duffel's real sandbox or live API (no token yet), a real UrubutoPay payment.
