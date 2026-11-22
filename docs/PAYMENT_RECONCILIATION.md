# Collections and settlement

The customer attempts remain in PostgreSQL across requests and restarts. UrubutoPay originals are verified by authenticated status lookup. Documented `VALID` and `PENDING_SETTLEMENT` represent completed collection in the provider reference. Thrill records customer credit and keeps the settlement status separate. A timeout, amount or identity discrepancy, or expiry without a verified final failure enters the review queue. Never open a replacement payment while the outcome could still change.

## Finance workflow

1. Open **Admin → Payments** or **Staff → Finance → Payment collections**.
2. Filter or export the register. Match an independently verified collection to the approved settlement bank account and the actual unique statement reference.
3. Record gross less fees using the net credit and fee fields, bank date and evidence reference. For a quotation this posts gross collection and separate payment charge to the existing finance ledger. The invoice balance counts the provider collection once before or after this step. A direct booking already has a separately mirrored payment row.
4. Verify refunds and supplier milestones in the existing case workspace. Record refunds against received funds and proof of payout. Payment verification and settlement do not confirm a ticket, supplier booking or event arrangement.
5. Investigate discrepancies with BK TecHouse. A grouped credit needs finance allocation evidence. The current settlement form matches a single verified transaction to one unique statement reference, so grouped batches require a separately reviewed procedure. Disputed or conflicting statuses must stay available for support review.

The authenticated callback can trigger an early check. Checkout checks are server-throttled per attempt. Vercel has a daily recovery schedule by default. Run a more frequent compatible worker for a commercial SLA, with explicit hosting approval and a measured load test. The VPS scheduler runs recovery every five minutes. Use worker health and register filters to monitor failures. CSV numbers are minor units for the exported currency.
