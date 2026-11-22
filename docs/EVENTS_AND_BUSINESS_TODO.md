# Thrill Events & Business rollout

## Public launch foundation

- [x] Add a public hub for retreats, conferences and delegation travel.
- [x] Keep distinct paths to weddings and corporate travel.
- [x] Submit a business event brief through the existing enquiry workflow, with the event type, organization, dates, headcount, location, budget and service needs.
- [x] Use the existing Events publication switch for the hub and its enquiry form.

## Venue sourcing and proposals

- [x] Add a Kigali directory with property and space search, published capacities by layout, comparison, and room-specific enquiries.
- [x] Allow administrators to add and publish managed properties and rooms, with capacities by layout and space notes for accessibility, AV and breakout facilities.
- [ ] Import the original sourced listings into the managed catalogue, and add floor plans and verification dates as operators supply them.
- [x] Give staff a case-level shortlist with supplier responses, room layouts, capacities, check dates and hold deadlines.
- [x] Add an event-specific proposal editor using the existing versioned quote and acceptance workflow.

## Organizer experience and pilot

- [x] Add UrubutoPay simulation screens and an administrator staging checkout using the provider's initiation and status APIs.
- [ ] Verify hosted card and mobile-money flows with merchant test credentials. Configure authenticated provider callbacks and settlement reconciliation before connecting live case balances.

Finance can issue a shared payment link for an accepted event proposal using the [central checkout](PAYMENT_INTEGRATION.md). The standalone simulation remains available in development and testing, and the administrator staging diagnostic uses separate test credentials. Follow the [UrubutoPay setup guide](URUBUTOPAY_SETUP.md) for eligible live collections.

- [x] Show venue, rooms, transport and activities milestones on the shared case page using existing customer and company access rules.
- [ ] Vet suppliers and pilot a Kigali meeting or delegation package and an overnight retreat.
- [ ] Track time to a supplier-checked proposal, acceptance, timely confirmations, margin after delivery and repeat requests.
- [ ] Use pilot results to decide whether to add rooming lists, attendee registration or recurring travel approvals.
