# Thrill Events & Business rollout

## Public launch foundation

- [x] Add a public hub for retreats, conferences and delegation travel.
- [x] Keep distinct paths to weddings and corporate travel.
- [x] Submit a business event brief through the existing enquiry workflow, with the event type, organization, dates, headcount, location, budget and service needs.
- [x] Use the existing Events publication switch for the hub and its enquiry form.

## Venue sourcing and proposals

- [x] Add a Kigali directory with property and space search, published capacities by layout, comparison, and room-specific enquiries.
- [ ] Add staff editing for directory entries, including accessibility, AV, floor plans and verification dates. Expand coverage as additional operators provide room information.
- [x] Give staff a case-level shortlist with supplier responses, room layouts, capacities, check dates and hold deadlines.
- [x] Add an event-specific proposal editor using the existing versioned quote and acceptance workflow.

## Organizer experience and pilot

- [x] Add UrubutoPay simulation screens and an administrator staging checkout using the provider's initiation and status APIs.
- [ ] Verify hosted card and mobile-money flows with merchant test credentials. Configure authenticated provider callbacks and settlement reconciliation before connecting live case balances.

The standalone simulation is at `/events-business/payment-preview`. It also appears on authorized cases with an accepted RWF proposal. It never writes to the finance ledger. The admin-only staging page is at `/events-business/payment-preview/staging`. Configure the three `URUBUTO_PAY_*` variables in `.env.example` and the site URL for the hosted return. Verify transactions using the provider status button after returning from checkout. See the [UrubutoPay API reference](https://developers.urubutopay.rw/reference/).

- [x] Show venue, rooms, transport and activities milestones on the shared case page using existing customer and company access rules.
- [ ] Vet suppliers and pilot a Kigali meeting or delegation package and an overnight retreat.
- [ ] Track time to a supplier-checked proposal, acceptance, timely confirmations, margin after delivery and repeat requests.
- [ ] Use pilot results to decide whether to add rooming lists, attendee registration or recurring travel approvals.
