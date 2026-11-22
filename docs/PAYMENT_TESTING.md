# Payment verification and testing

Use `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`. Automated tests use fixture responses or local PostgreSQL. They must never submit real customer payments. The core verifies responses against invoice amounts and scopes tests to the documented provider endpoints.

With project-local PostgreSQL running, use `npx tsx scripts/check-payment-collections.ts` to apply all migrations to a disposable database and exercise the real payment transactions and API handlers with mocked provider responses.

## Required merchant testing before deployment

- Run MTN, Airtel and hosted card in the approved testing environment. Capture independent statuses for approval, rejection, insufficient funds, expiry, customer cancellation and any 3D Secure challenge. Confirm the exact hosted origin, status payload, wallet number handling and transaction identifiers.
- Check tampered callbacks, duplicate and late callbacks, expired callback tokens, gateway timeout and unknown references. A browser return alone must never release funds or confirm a supplier. Confirm the pending queue recovers after a server restart.
- In Chrome or another supported browser, verify guest, signed-in and mobile checkouts. Test expired and rotated guest links, incorrect exposed amount submission, repeated checkout, concurrent deposit and balance attempts, approved bank instructions, receipt downloads, private cache headers and staff-only exports.
- Check provider/bank statement fees, discrepancies, refund amounts and supplier confirmation controls. Verify operational sign-off for manual refunds and late capture handling. Test scheduled recovery and a realistic queue backlog before live traffic.
- Test direct MTN and Airtel only with the approved sandbox credentials and specifications. Confirm PayPal merchant eligibility before building or running its checkout. Supplier payouts, automated refunds, USD card charges and FX are outside the enabled paths.
