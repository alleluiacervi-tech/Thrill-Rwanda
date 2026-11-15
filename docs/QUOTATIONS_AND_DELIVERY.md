# Written quotations and notification delivery — Phase 3

Phase 3 extends the existing enquiry workspace. It does not create bookings, reserve inventory, issue tickets, move money or reconcile receipts. Production services, commercial terms, policies and notification channels still require business approval.

## Prepare, issue and share a quotation

An active administrator or the assigned sales owner can issue quotes from the enquiry detail page. Contact the customer and assign an active owner first. Operations can read accessible customer-facing quotes but cannot issue or accept them. Finance cannot open quote documents or customer/travel data through this workspace.

Use **Prepare a new quotation version** to enter the service, travel dates/route/itinerary, supplier/baggage conditions, taxes/charges treatment, payment/change/cancellation/refund terms, validity and payment deadline. Dates use Kigali time (UTC+2). The payment deadline must be future and no later than expiry.

The customer-facing breakdown must include separate supplier charges and a Thrill Rwanda service fee, even if the fee is zero. Tax/other lines are optional but must reflect approved treatment. Supported currencies are USD, EUR, GBP and RWF; USD/EUR/GBP accept up to two decimal places, RWF whole units. Amounts are calculated server-side in integer minor units, with bounded quantities/totals. Customer collections are not profit; internal supplier economics and reconciliation use the separate [Phase 4 financial workspace](FINANCE_AND_SUPPLIERS.md).

Draft edits live only in the form. Review the fields and total before issuing; drafts are not autosaved. Issuing creates an append-only version with its full customer-facing snapshot: customer/company details, preparer, line items, totals, terms and dates. The enquiry moves to Quote sent. This status means a written quote was issued; it does not prove email delivery.

Open a version for its customer-ready preview, printable/save-as-PDF view and standalone HTML download. Share that copy through the approved channel. Internal notes are shown separately to authorized editors and excluded from the customer document, print view and email. The preview identifies historical versions; confirm the current version before sharing. A separate automated PDF generation service is not included.

To revise an unaccepted quote, issue a new version. Earlier versions remain unchanged and cannot be accepted. Company-setting changes affect new versions only. An issue form has an idempotency token; a retry with identical fields returns its existing version, while changed details under the same token are rejected. Concurrent edits/issuance use the enquiry version to prevent silent overwrite.

## Record customer acceptance

The latest issued version has an acceptance form while it is unexpired, within its payment deadline and the enquiry remains Quote sent. Record the customer's accepting name, actual communication channel and evidence/reference, then attest that the customer accepted that exact version, total and terms.

This is a staff-verified acceptance record, not a customer portal signature. The record identifies the quote ID/version and content digest, recorder, timestamp, channel, name and evidence. It moves the enquiry to Awaiting payment. It does not mark any Payment paid or create a Booking.

Expired/superseded versions cannot be accepted or backdated into validity. Existing acceptances cannot be edited or silently replaced by issuing another version; approved change/cancellation handling is separate work. Repeating the same acceptance request is safe, and changed acceptance details are rejected. Generic triage actions can no longer bypass quote issuance or exact-version acceptance by manually selecting Quote sent/Awaiting payment. Existing external milestones remain historical records; staff must issue/adopt a proper written version for new acceptance.

Snapshots, acceptance and activity are append-only through application actions. The SHA-256 digest detects content changes when reading, emailing or accepting a version; it is not a digital signature, proof of supplier authority or protection against a database administrator who can rewrite both content and digest.

## What notifications are queued

- New enquiry: an acknowledgement email only when the customer supplied email and selected EMAIL as the reply channel; reference/next steps are included without detailed travel data.
- New enquiry: generic in-app staff alerts for active administrators. No customer/travel details appear in the alert; the secure workspace enforces permissions.
- Assignment: an in-app alert for the new owner. Delivery rechecks current permissions; revoked recipients are cancelled.
- Issued quote: email only when the issuing user explicitly selects the checkbox and EMAIL is the customer's preferred channel. The full immutable customer-facing quote is included in HTML and plain text. Phone/WhatsApp sharing remains manual; opening a chat is never recorded as message delivery.

Enquiry persistence and initial job creation are one transaction; retries do not create duplicate jobs. Quote issuance, its requested email job and audit activity are also atomic. Provider calls happen later, outside those transactions, so delivery failure does not remove a saved enquiry/quote.

Outbox payloads contain customer-facing email copies; restrict database access and include them in the approved retention/deletion and backup policy. The enquiry page displays the latest 30 jobs, current state, safe error codes and the latest five attempt records per job. Recipient addresses/payloads are not exposed in this job list. Queued is not sent; SENT for email means provider acceptance, not inbox arrival/read confirmation. SENT for in-app delivery means the notification row was saved.

Existing booking/account emails retain their best-effort delivery behavior; their timestamp bug was fixed separately. A successful send now updates only that recipient's rows for that exact event, never older unsent events or another recipient's failed/skipped message. This does not migrate all legacy notifications into the new enquiry outbox.

## Run the worker

No scheduler or external messaging account was activated during development. Configure and validate these deployment prerequisites before promising automated delivery:

1. Allow outbound HTTPS to `api.resend.com` while preserving other required network rules. Set an approved, verified `EMAIL_FROM` and protected `RESEND_API_KEY` in the intended environment. Use company-controlled accounts and a controlled staging inbox for real delivery tests. Never paste secret values into chat, source, logs or this document.
2. Set `CRON_SECRET` securely. It authorizes the new worker route and the existing stale-hold route. An unset secret returns 503, a wrong bearer returns 401; a staff login alone does not authorize cron execution.
3. Configure an approved scheduler to request `GET /api/cron/enquiry-notifications` with `Authorization: Bearer <CRON_SECRET>`. For example, poll every few minutes if the hosting plan permits it. Each request processes at most three jobs and has a 60-second route budget. Review plan limits, capacity and response times before choosing frequency. `vercel.json` scheduling was deliberately left unchanged rather than assuming a paid cron capability.
4. Alternatively run `npm run notifications:work` from the repository root in the intended service environment; each invocation processes one batch. This command can send email. Use `npm run notifications:work -- --dry-run` to count outstanding jobs without sending or modifying records.
5. Monitor pending age, blocked jobs, attempts, provider acceptance and actual staging inbox receipt. A saved draft, successful build or queued job is not evidence that deployment scheduling or real provider delivery works.

The worker uses PostgreSQL claims with five-minute leases and claim tokens, persistent attempts, bounded retries and exponential backoff. Concurrent workers cannot normally claim the same live lease. In-app messages use a fixed notification ID to avoid duplicate rows. Email requests use stable per-job Resend idempotency keys, a ten-second provider timeout and a saved exact payload so settings changes between retries do not change its content or saved sender. Keep the same provider account during retries; switching accounts requires delivery review.

Delivery is at-least-once processing with provider idempotency protection, not an unconditional exactly-once guarantee. A provider can accept a request before a process crashes. When more than 23 hours have elapsed since the first external attempt, the worker blocks uncertain delivery for human review instead of blindly relying on an expired provider idempotency window.

## Failures and retries

| State / code | Meaning and action |
|---|---|
| PENDING | Waiting for worker; inspect scheduler/backlog if old. |
| SENDING | A worker holds a lease. Expired leases may be recovered; attempts show lease expiry rather than claiming delivery. |
| FAILED / PROVIDER_TEMPORARY / DELIVERY_TEMPORARY | Retryable provider/network failure. Worker retries when backoff is due; operator can queue an earlier retry if authorized. |
| BLOCKED / EMAIL_CONFIGURATION_MISSING | No approved sender/API configuration was present. Correct secure settings, then queue a retry. No send is claimed. |
| BLOCKED / PROVIDER_REJECTED | Provider rejected the request. Check sender/account configuration privately before retrying. Raw provider bodies, credentials and travel data are not written to error codes/logs. |
| BLOCKED / ATTEMPTS_EXHAUSTED | Five claims/delivery attempts exhausted the budget. Investigate and use an approved manual channel; do not repeatedly reset state blindly. |
| BLOCKED / DELIVERY_REVIEW_REQUIRED | Delivery is uncertain beyond the safety window. Check provider records and whether the customer already received it; no blind resend is offered. |
| BLOCKED / QUOTE_INTEGRITY_FAILED | Snapshot digest mismatch; stop sharing and investigate. |
| CANCELLED / QUOTE_EXPIRED_OR_SUPERSEDED | Old quote will not be emailed. Issue a current checked version if needed. |
| CANCELLED / CHANNEL_NOT_APPROVED / RECIPIENT_ACCESS_REVOKED | Contact preference, destination or staff permission no longer authorizes delivery. Review the record instead of bypassing access. |

Administrators and the assigned sales/operations owner may queue eligible failed/blocked jobs for retry. The action rechecks access, state, attempt budget and safety window, and appends an audit entry. It queues delivery, not immediate sending. Finance/public callers cannot retry. The UI suppresses retries requiring exhausted/uncertain-delivery review. Do not edit jobs, quote snapshots or acceptance rows directly as a routine support workflow.

## Validation and handover

Apply the additive migrations and generate Prisma before deploying the new code. `20261115190000_quotes_and_notification_outbox` creates versions/acceptance/outbox/attempt tables; `20261115200000_notification_message_snapshot` freezes email payloads. Existing booking/payment records are retained.

Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, plus the guarded local-only scripts:

- `npx tsx scripts/check-flight-enquiries.ts`
- `npx tsx scripts/check-enquiry-workflow.ts`
- `npx tsx scripts/check-quotations.ts`

The quotation integration script injects fake transports and sends no external email. It checks immutable revisions/download content, exact-version acceptance, expired/superseded quotes, concurrent issue/accept requests, retries/idempotency, per-attempt records, worker leases, missing configuration, uncertain-delivery review, revoked access and unchanged booking/payment counts. Cleanup removes only generated test fixtures.

Real provider acceptance/inbox delivery, recurring scheduling, founder approval of commercial/policy wording, retention/backups and production rollout remain deployment/business validation. No production migration, publication, customer message or live payment was performed during this implementation.

Revision assistance and customer exact-version acceptance are documented in [Client portals and channels](CLIENT_PORTALS_AND_CHANNELS.md). Optional WhatsApp uses the same durable outbox but blocks uncertain sends because its endpoint is not assumed idempotent.
