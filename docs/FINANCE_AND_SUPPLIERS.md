# Off-site finance and supplier fulfilment

Phase 4 extends accepted quotations with a separate, audited off-site ledger. Staff can access **Finance** and **Suppliers** from their dashboard, and the financial workspace from an accepted enquiry. Nothing here sends money, issues tickets, creates gateway payments or automatically creates bookings. Existing Pesapal records remain in Gateway payments.

## Access and initial setup

Administrators approve settlement accounts and supplier records. Finance manages money and commercial review, with no access to private enquiry travel/contact details. Assigned sales staff can record pending receipts and view balances. Assigned operations staff can draft suppliers, view operational supplier details and verify fulfilment; supplier costs and commercial contracts remain private to administrators/finance. Role and ownership are checked again on every mutation.

An administrator records an approved account's method, currency, payment instructions and approval evidence. Store payment instructions and statement references only; never enter passwords, API credentials or card details. Deactivating an account blocks new cash records while retaining its history. Register each real account once: duplicate protection is based on its account ID and normalized statement reference.

A supplier record covers category, contacts/escalation, service area, deliverables, limitations, supported currencies, commercial terms, agreement evidence, performance notes, next review and publication permission. Operations can draft records; administrators approve or suspend them. Recording permission does not automatically publish supplier branding or claims. Business owners must verify contracts and approve public wording before launch.

## Accepted quote to completed service

1. Open an accepted enquiry. Select approved, same-currency off-site payment instructions.
2. Record the payer, actual receipt total, statement reference, date and supporting evidence. Optionally allocate part to this accepted quote. This is **pending** and contributes no reconciled customer cash.
3. Finance independently checks the bank/mobile-money statement or cash evidence and reconciles the receipt. Only its active allocations become case collections. Split further allocations across same-currency accepted cases as needed. Concurrent changes cannot allocate more than the receipt total. Unallocated reconciled funds remain held cash, separate from case collections.
4. Record every supplier commitment and supporting contract reference. Finance reviews the agreed customer charge, retained fee, tax/pass-through reserve and funding threshold. The default threshold is the full accepted quote; an explicit approved deposit threshold can allow partial funding. Record complete expected supplier costs before review.
5. Release supplier processing once reviewed costs, approved suppliers and reconciled funding meet the threshold. An unchecked generic status change cannot bypass these controls.
6. Operations verifies each supplier's actual confirmation separately. Final service confirmation requires every commitment to be confirmed and its supplier approved. Record the primary confirmation reference and evidence. Authorized partners remain responsible for ticket issuance.
7. Record actual service completion. One independent fulfilment record is retained per case. An administrator may optionally link an existing completed, matching legacy booking with no payment attempts and matching customer/service details. Flights retain independent fulfilment because legacy bookings have no flight type. Linking never creates or edits a booking or payment.

## Corrections and refunds

Every command requires verification, evidence, a current case version and an idempotency key. Repeated identical submissions reuse their result; changed inputs or stale forms are rejected. Reload after a concurrent change. The private financial audit retains inputs and before/after budgets. Generic enquiry activity contains milestone summaries rather than private financial details.

Receipt amendments preserve their proof identity and cannot reduce the total below active allocations. Release an allocation to reverse its case credit without erasing the reconciled receipt. Reversing a whole receipt releases all allocations and retains its reserved statement reference. Reverse dependent payouts/refunds first when a correction would otherwise produce an impossible balance. These are accounting corrections, not automated chargebacks.

Supplier debit/credit adjustments change the contractual payable. Payments reduce supplier due; credits after payment can create a supplier recoverable. Record recovered money separately. Payment charges and separately received commissions have their own cash proofs. Record commission only when it has not already been netted from supplier costs. Reversals append equal/opposite journal entries. A corrected nonreceipt cash amount may reuse a statement reference only when its previous journal balance is zero and the case, kind and counterparty match.

Cancellation alone does not mean a refund has been paid. Cancellation invalidates the commercial review. Finance must review the final charge and costs, approve a distinct refund obligation, then record each actual payout against approved settlement evidence. Partial payouts leave a remaining obligation. Amend an obligation through an audited adjustment, never below the amount already paid. Payouts cannot exceed the obligation or available customer credit. A cancelled case becomes Refunded only after positive refund obligations are fully settled and no customer credit remains. Reversing a payout or adding new credit reopens the cancelled case. A completed service can retain its status while an overpayment refund is settled.

## Reporting definitions

All values remain in their original currency; reports never add USD and RWF. RWF uses whole francs. The finance report covers this off-site ledger across all time. Gateway collections are reported separately. Neither report establishes statutory revenue or profit.

- **Collections:** reconciled allocations, less allocation/receipt reversals.
- **Customer net cash:** collections less actual refund payouts.
- **Customer credit / outstanding:** net cash compared with the reviewed agreed customer charge.
- **Refund due:** approved obligations plus amendments less actual payouts.
- **Supplier due / recoverable:** contractual costs plus debit/credit adjustments compared with payments less recoveries.
- **Operational contribution:** agreed customer charge minus pass-through reserve, net supplier costs and payment charges, plus separately received commission. It is unknown until commercial review is complete. Cost/charge changes and cancellation invalidate that review.
- **Cash position:** cash actually collected/paid, distinct from contribution and outstanding obligations.

The review initially retains the accepted quote's charge/fee and conservative TAX/OTHER pass-through reserve. Final concessions may reduce charge and fee only after completion/cancellation/refund, within the accepted original. Review evidence must explain all reserved amounts, complete supplier costs and any approved funding exception. A retained fee, supplier spread, unallocated cash and collected tax are different measures.

## Local validation and release limits

Keep `npm run db:local` running, generate Prisma, and apply committed migrations with `npm run db:deploy` against the intended local database. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npx tsx scripts/check-enquiry-workflow.ts` and `npx tsx scripts/check-finance.ts`. Integration scripts guard the project-local database and remove only their generated fixtures. They do not move money or send notifications.

Production migrations and publication are separate release actions. Real accounts, contracts, statement checking and accounting/tax treatment need company approval. Pesapal activation, automatic payouts, exchange conversion, statutory accounting exports and gateway-to-off-site reconciliation are not part of this phase. Reports currently load all off-site cases; pagination, date filters, exports and scale/performance work remain for later reporting work. Supplier performance is manually recorded; alerts and automated partner integrations remain later work.
