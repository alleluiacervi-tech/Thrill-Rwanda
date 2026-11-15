# Enquiry operations

This guide describes the implemented staff workflow. It does not authorize publication of services, payment methods, supplier claims or policies. Written quotes and notifications now have a separate [Phase 3 runbook](QUOTATIONS_AND_DELIVERY.md); off-site finance and fulfilment use the [Phase 4 runbook](FINANCE_AND_SUPPLIERS.md).

## Access and entry points

- Guests use `/flights`, `/enquire`, `/contact`, or the group enquiry form on `/corporate`. Submissions are saved to PostgreSQL, not sent through personal email/chat. A saved reference does not mean email was delivered, stock held or a service confirmed.
- Administrators use `/admin/enquiries` and manage staff permissions under `/admin/users` → Staff permission. Grants/revocations are stored in `staff_access_changes`.
- Staff use `/staff/enquiries`. Sign-in selects this workspace for staff accounts; it is also available from the account workspace switcher.
- Manual capture is at `/staff/enquiries/new` (also accessible through the admin inbox). Record the true source and evidence that the customer permitted contact. Do not invent consent or paste identity/card data.

Staff access is a separate optional `User.staffRole`; existing CUSTOMER, PROVIDER and ADMIN roles and booking history remain intact. Public signup cannot grant staff permissions. Fresh database permissions are checked on new workflow reads and writes rather than trusting a cached session role.

| Capability | Administrator | Sales | Operations | Finance |
|---|---|---|---|---|
| Read lead contact/travel details | All leads | Own + unassigned | Own + unassigned | No |
| Claim an unassigned lead | Yes | Self | Self | No |
| Assign another owner | Active admin/sales/operations | No | No | No |
| Notes and follow-up | All | Own (or claim) | Own (or claim) | No |
| Contact / needs information | Yes | Yes | Yes | No |
| Issue quotations / record exact-version acceptance | Yes | Yes | No | No |
| Reconcile off-site receipts / refunds | Yes | No | No | Yes |
| Capture a pending receipt | Yes | Own | No | Yes |
| Record supplier confirmation / completion | Yes | No | Yes | No |
| Offline enquiry capture | Yes | Yes | Yes | No |
| Grant or revoke staff access | Yes | No | No | No |

Finance reads only reference/service/status/owner/source/follow-up metadata in its queue, private off-site financial records and its financial activity entries. Customer contact, travel details, general notes and contact history are not rendered to finance. Its queue covers Awaiting payment, Partner processing, Confirmed, Completed, Cancelled and Refunded. Sales/operations cannot access leads assigned to another person. History and search apply the same scope as the inbox; searching never expands access.

## Handling a request

1. Search/filter by status, service, source, assignment and overdue follow-up. Unassigned requests are visible to sales/operations so they can claim them.
2. Open the enquiry. Set an owner (staff saving an unassigned request claims it for themselves), record contact and notes, and schedule a follow-up in **Kigali time, UTC+2**. The first Contacted/Needs information action records the first-response timestamp.
3. Needs information requires a follow-up. Set the next date/time and explain what information is missing in a note.
4. Use the quotation workspace to issue a checked immutable version and record exact-version acceptance. Use the finance/fulfilment workspace for statement reconciliation, supplier processing and checked confirmations. Evidence must describe records actually verified; entering a reference does not verify it externally.
5. Lost and Cancelled require a reason. Financial review and separate refund obligations/payouts govern refunded outcomes; cancellation alone does not settle money. Follow the Phase 4 runbook for corrections and final balances.

Allowed lifecycle edges:

| Current state | Allowed next states (further limited by staff permission) |
|---|---|
| New | Contacted, Needs information, Cancelled, Lost |
| Contacted | Needs information, Quote sent, Cancelled, Lost |
| Needs information | Contacted, Quote sent, Cancelled, Lost |
| Quote sent | Contacted (revision/review), Awaiting payment, Cancelled, Lost |
| Awaiting payment | Partner processing, Cancelled |
| Partner processing | Confirmed, Cancelled |
| Confirmed | Completed, Cancelled |
| Cancelled | Refunded |
| Completed / Refunded / Lost | Terminal; no reopening through this workflow |

The lifecycle table describes outcomes, not unrestricted generic status edits. Quote sent/Awaiting payment require quotation actions. Partner processing/Confirmed/Completed/Refunded require financial or fulfilment controls. Reconciled receipts use a separate off-site ledger, never the existing gateway `Payment` table. None of these actions moves money, issues tickets, reserves inventory or automatically creates bookings. A financial correction can reopen a Refunded case as Cancelled when credit or obligations reappear.

## Concurrent changes and activity

Every update compares the submitted version with the database version and atomically appends an activity entry with actor, timestamp, before/after values, reason, evidence and note. Only one concurrent edit of the same version can succeed. If told to reload, review the latest timeline and reapply only intended changes; never overwrite another person's work blindly.

Activities and staff-access changes are append-only through the application's actions; there is no edit/delete UI or mutation endpoint for them. This is not a claim of cryptographic or database-administrator tamper resistance. Direct database maintenance, retention, backup and audit-log protection require the later operational controls. Detail pages display the latest 100 activities.

Contact history matches normalized supplied phone digits or a lowercase email when no phone was supplied. It is limited to accessible leads and is not identity verification. Guest records are never silently merged into customer accounts, and inconsistent phone formats may not match. An administrator must investigate identity before using history to disclose information externally.

## Persistence, privacy and compatibility

Guest captures have durable submission keys and payload fingerprints. Retrying the same form returns the original reference; reusing its key with changed details is rejected. Phase 1 flight fingerprints remain compatible with forms saved before this refactor. The PostgreSQL contact limit applies to public requests; authenticated staff capture is audited and exempt from that public limit. Perimeter abuse protection, contact normalization rules, monitoring and retention/deletion remain launch-hardening work.

Consent records include wording/version, privacy version and creation time. Privacy version `0` means a draft notice, not an approved policy. Staff capture records the staff-provided permission evidence under `staff-recorded-v1`; it must not be represented as the customer checking an online checkbox.

Contact/corporate forms no longer claim that opening WhatsApp saved or sent a request. Their legacy action names forward to durable validation and require the current form fields/consent; stale old-form submissions fail safely. Catalogue handoff context is retained as bounded text, with no trusted prices or booking side effects. Existing bookings remain accessible. New direct booking is governed by the explicit service modes in [Launch controls](PUBLIC_LAUNCH_SUPPORT_AND_REPORTING.md); unconfigured services default to enquiries.

## Development and checks

After reviewing the target environment, generate Prisma and apply committed migrations. Keep the local database running with `npm run db:local`; use `npm run db:deploy` for committed migrations. Do not run the local test scripts against production.

- `npm test`: validation, authorization/state rules, persistence and action failure cases.
- `npm run lint`, `npm run typecheck`, `npm run build`.
- `npx tsx scripts/check-flight-enquiries.ts`: duplicate-safe public flight capture and concurrent contact limits.
- `npx tsx scripts/check-enquiry-workflow.ts`: local-only scoped ownership, concurrent edits, evidence/follow-up, revocation, activity persistence and no booking/payment effects. Fixtures are deleted by their generated IDs.

Before deploying this code elsewhere, apply all committed migrations and regenerate Prisma. Development migration success is not production migration evidence. Approve staff responsibilities, privacy, services, commercial processes and external fulfilment arrangements before launch.
