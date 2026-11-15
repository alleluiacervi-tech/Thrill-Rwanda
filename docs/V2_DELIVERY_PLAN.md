# Thrill Rwanda — phased delivery plan and work checklist

Updated: 15 November 2026. Baseline: [V2 implementation audit](V2_IMPLEMENTATION_AUDIT.md). This is a development plan, not founder approval of services, policies, suppliers or production release.

## Delivery approach

Extend the existing Next.js/PostgreSQL application. Reuse its visual components, catalogue, authentication, admin shell and established booking/payment records. Add an enquiry domain alongside Booking: a guest request has no customer-account, supplier, stock or payment prerequisite. Connect an accepted, checked quotation to fulfilment later through an explicit audited handoff. Do not reinterpret existing bookings as enquiries or migrate financial history implicitly.

Ship small end-to-end slices with schema migrations, tests and explicit completion gates. A checked item means the described code is implemented; release approval and production evidence remain separate. All application/database validation in this change uses the local development instance. No production migration or publishing is performed.

## Phase 0 — prior work, baseline and compatibility

- [x] Review the Version 2 brief against the actual repository; retain the audit as a dated baseline.
- [x] Inventory reusable work: public catalogue, detail pages/galleries, auth, customer/provider/admin dashboards, booking engine, Pesapal, notifications, reviews, settings, legal content and storage.
- [x] Recover generated Prisma client using the existing supported generation command.
- [x] Establish separation between guest enquiries and inventory-backed bookings.
- [x] Preserve existing booking/payment schema and workflows in this first additive migration.
- [ ] Founder approves deliverable launch services, flight-ticketing partner, claims, policies, contacts and account ownership.
- [ ] Audit stored site settings and seeded content, in addition to source defaults, for approved launch copy.
- [ ] Decide which existing direct-booking service modes remain available; enforce approved restrictions on the server and UI together.

Compatibility gate: existing booking tests pass, no destructive schema changes, and old records remain readable. Preservation does not mean legacy direct booking complies with the new launch brief; restricting it is a separate required rollout task.

## Phase 1 — guest flight enquiry foundation (implemented first slice)

Frontend:

- [x] `/flights` assisted quote page, using the existing page shell, typography and buttons.
- [x] Guest form: route, return/one-way, dates/flexibility, adults/children/infants, cabin/baggage, contact, reply channel and notes.
- [x] Optional email; phone/WhatsApp contact required. No login, passport upload or card collection.
- [x] Explicit unchecked privacy/contact consent and reference confirmation with safe next-step wording.
- [x] Visible validation errors, pending submission state and duplicate-safe retry messaging.
- [x] Navigation/footer/sitemap link and header/home flight CTA; preserve catalogue discovery.
- [x] Replace the homepage guarantee heading and misleading live-availability/payment default hero copy.

Backend and operations:

- [x] Additive `Enquiry` table and migration, without touching booking/payment tables.
- [x] Persist reference, source, contact, structured flight details, consent wording/version and privacy version/timestamp.
- [x] Validate calendar dates, date order, counts, contact channel, bounded text and consent on the server.
- [x] Idempotency token plus payload fingerprint; mismatched token reuse is rejected.
- [x] Database advisory locks serialize concurrent token retries and contact submissions across application instances.
- [x] Honeypot and database-backed maximum of five new requests per phone number per hour; retries return the original reference.
- [x] Protected admin inbox/detail with search, pagination, contact preferences and consent evidence.
- [x] Preserve the request even when email is unconfigured: this slice saves to the admin inbox and sends no external messages.
- [x] Unit tests and local PostgreSQL concurrency/integrity check (`npx tsx scripts/check-flight-enquiries.ts`).
- [ ] Launch hardening: perimeter/IP abuse controls, monitoring, retention/deletion policy, approved privacy notice and rate-limit tuning.
- [ ] Durable customer/staff notifications and retries (Phase 3). The confirmation currently promises a saved request, not delivered email/chat.

Gate: phone-only guest request persists once, concurrent retries do not duplicate, an admin can inspect it, and unauthenticated users cannot access the inbox. No seat is held, booking created, payment initiated or ticket issued. This foundation is not the complete lead-management MVP.

## Phase 2 — staff triage and multi-service requests

- [x] Add enquiry status model: New, Contacted, Needs more information, Quote sent, Awaiting payment, Partner processing, Booked/confirmed, Completed and separate terminal/outcome handling.
- [x] Add owner, next follow-up, first response, notes/activity timeline and reason fields.
- [x] Add conflict-safe edits, validated transitions and activity events that are append-only through application actions.
- [x] Extend staff permissions for sales, operations and finance; do not give all staff ADMIN access.
- [x] Add lead board, owner/status/service/source filters and overdue queue using existing dashboard/table components.
- [x] Add manual lead capture for phone, WhatsApp, referrals, social and organization outreach.
- [x] Add service-aware trip, stay, transport, group and optional event forms using the shared enquiry core.
- [x] Move contact/corporate requests from email-only capture into durable enquiries, preserving selected catalogue context.
- [x] Provide permission-scoped history matching supplied contact details; keep guest/customer accounts separate without automatic identity merges.

Integration with prior work: use current session guards and admin shell, extend permissions centrally, keep provider scoping, and adapt catalogue CTAs only after the approved service-mode policy is enforced. Guest data must never become publicly searchable by reference alone.

Gate: staff can assign, contact, record notes, schedule follow-ups and handle an approved service lead without personal email/WhatsApp being the only record. Authorization and concurrent-edit tests pass.

Phase 2 implementation: `/staff/enquiries` provides scoped triage; administrators retain `/admin/enquiries`. New service requests and offline capture reuse the same persistence layer as flight enquiries. Milestones record staff-checked external evidence; they do not generate quotes, reconcile payments or create bookings. See [Enquiry operations](ENQUIRY_OPERATIONS.md) for permissions, state rules and limitations. Founder approval of actual staff responsibilities remains a launch gate.

## Phase 3 — written quotes and reliable communication

- [x] Quote/version/items schema; immutable issued snapshots and expiry/payment deadlines.
- [x] Supplier conditions/baggage, service description, dates, currency/tax and approved fee breakdown.
- [x] Exclude internal notes from customer copies; structured supplier net costs, commission and contribution accounting are delivered in Phase 4.
- [x] Staff editor, preview, issue/share and revision history; attach written quote if PDF automation is deferred.
- [x] Acceptance evidence bound to the exact issued version; handle expired/revised quotes explicitly.
- [x] Transactional outbox or equivalent durable notification jobs with per-recipient outcome, retries and safe staff alerts.
- [x] Customer acknowledgement and staff-owner notifications through approved channels only.
- [x] Repair existing notification `sentAt` bookkeeping so one recipient's successful send cannot mark other attempts as sent.
- [ ] Optional automated PDF generator remains deferred; customer-ready HTML download, print/save-as-PDF preview and HTML/plain-text email copies are implemented.

Integration with prior work: reuse branded email rendering/templates and inbox UI, but do not assume best-effort booking notifications satisfy durable lead delivery. Sending a quote is not booking confirmation.

Gate: staff can issue/revise a reproducible quotation, record exact acceptance and recover notification failures without losing the lead or showing false success.

Phase 3 now enforces quote issuance and exact-version acceptance in the quotation workspace; generic triage cannot bypass those steps. Acceptance is recorded by authorized staff with evidence, not through a new customer portal. Delivery is durable but requires a configured sender and recurring worker in deployment. See [Quotations and delivery](QUOTATIONS_AND_DELIVERY.md) for commercial fields, retries, scheduling and limitations.

## Phase 4 — approved payments, supplier fulfilment and finance

- [x] Approved off-site payment instructions and receipt/reference capture.
- [x] Permission-scoped reconciliation, duplicate receipt protection, partial allocations and reversals.
- [x] Separate collections, supplier/ticket payable, retained fees/commission, charges, refunds and contribution by currency.
- [x] Supplier register or controlled internal register: categories, contacts, agreements/rate sheets, service areas, restrictions, escalation and publication permission.
- [x] Supplier processing and checked confirmation/ticket reference; issuance remains with the authorized ticketing partner.
- [x] Explicit link from accepted/reconciled enquiry to a fulfilled booking/service record where needed; preserve legacy bookings and gateway attempts.
- [x] Refund/cancellation obligations tracked independently of a simple cancelled status.
- [x] Update reporting terminology: customer collections are not retained revenue or profit.
- [x] Validate payment search against `Payment.idempotencyKey` rather than the absent schema field `merchantReference`.
- [ ] Activate Pesapal only if provider account, settlement, ownership, refunds and reconciliation are approved; otherwise keep it deferred for the quote-led launch.

Integration with prior work: preserve the existing payment ledger and reconciliation safeguards. Never mark a legacy payment succeeded from an unchecked staff form or reuse booking inventory holds as flight fare holds.

Gate: accepted quote → verified receipt → reconciled money → supplier processing → checked supplier confirmation, with financial reconciliation and audit evidence.

## Phase 5 — public launch alignment, support and reporting

- [ ] Complete flights-first home/service cards/how-it-works and FAQ/policy coverage.
- [ ] Replace unsupported prices, audited-partner/driver claims, compliance wording, credit terms and response promises on every public page.
- [ ] Resolve home vs `/transfers` service-availability contradictions; enforce approved publication modes.
- [ ] Curate only approved packages; make itinerary, suitability and inclusions/exclusions editable per offer.
- [ ] Establish after-booking support ownership, hours, escalation, cases and outcomes.
- [ ] Source/CTA analytics without contact or sensitive travel data; weekly response, conversion, follow-up, lost/unresolved case and supplier metrics.
- [ ] Permission-scoped search/exports and financial reports with spreadsheet-injection protections.
- [ ] Remove autoplay-first video; test mobile performance, keyboard/focus, contrast, labels/errors, touch targets and overflow.
- [ ] Add approved metadata/share images for all enabled pages and verify contact links.
- [ ] Fix production reset-token logging and test suspension/role revocation on sensitive actions.
- [ ] Validate retained-document necessity, access, audit and deletion rules.

Gate: the [audit acceptance matrix](V2_IMPLEMENTATION_AUDIT.md#12-v2-acceptance-checklist-coverage) passes in staging against the approved launch service scope.

## Phase 6 — operational release and handover

- [ ] Dev/staging/production separation, protected secrets, company-owned accounts and access register.
- [ ] Tested database backup/restore, deployment/rollback, incident monitoring and named operational owners.
- [ ] Admin/staff guides, environment-variable list, current schema/export instructions and known limitations.
- [ ] Third-party costs, subscriptions, account owners and renewals documented.
- [ ] Approved brand/content/policies and supplier evidence recorded; restricted soft launch with manual request review.
- [ ] Update stale README/architecture status against implemented behavior and current test evidence.

Gate: acceptance evidence, restore test, staff walkthrough and founder sign-off; publishing is a separate action.

## Later phases — evidence-led expansion

- [ ] Extend the existing customer area to own enquiry/quote history (Phase 2 business roadmap enhancement).
- [ ] Automated WhatsApp updates after approved provider/channel setup.
- [ ] Expanded supplier performance tools, curated packages and optional quotation automation.
- [ ] Corporate client portal and supplier integrations only after commercial justification, permissions and founder approval.

Remain out of launch scope: live airline/GDS fares, automatic ticket issuance/fare holds, card storage, wallets, automatic supplier payouts, native apps, loyalty and AI planning. Optional brand division names do not require separate applications.

## Developer run and validation notes

From the repository root, use `npm run db:generate`, keep `npm run db:local` running, and apply committed migrations with `npm run db:deploy` against the intended local database. Run `npm test`, `npm run lint`, `npm run typecheck`, `npx tsx scripts/check-flight-enquiries.ts` and `npm run build`. The integration script refuses non-project-local/production URLs and deletes only its randomly keyed test records.

The flight form is dynamically rendered so each page load has a fresh submission token; retries of the same form retain its key. PostgreSQL persists submissions before success is shown. Phase 1 did not send email/WhatsApp or implement workflow transitions. Phase 2 adds staff triage and externally checked milestone records; it still does not send messages or globally disable existing direct-booking services. Until later gates are met, do not represent the entire site as a launch-ready Version 2 platform.

## Validation evidence — first implementation slice

- Prisma client generation and all 21 committed migrations applied successfully to project-local PostgreSQL, including the additive enquiries migration.
- `npm test`: 15 test files / 138 tests passed, including existing booking/settings tests and new schema, persistence and server-action failure cases.
- `npm run lint`, `npm run typecheck` and production `npm run build`: passed. The final build includes the corrected PostgreSQL lock query and form retry handling.
- `npx tsx scripts/check-flight-enquiries.ts`: passed real PostgreSQL concurrent duplicate submission, payload mismatch, concurrent contact-rate limit, consent persistence and no-booking/no-payment checks. Test records removed.
- Local Chromium/Playwright smoke test against the production build: passed phone-only guest submission; invalid-route error with retained values/consent and no saved row; corrected retry with saved reference; anonymous redirect; signed-in CUSTOMER denial; ADMIN inbox/detail and consent evidence; widths 390/768/1024/1440 without page overflow; no browser page errors. Disposable test account and request removed. Browser tooling was installed outside the checkout for this smoke test and is not a new project dependency or a committed browser test suite.
- No production database changes, environment configuration updates, publishing, external customer messages, or live payment tests were performed. These checks validate the first slice, not all V2 acceptance criteria or full accessibility/security compliance.


## Validation evidence — Phase 2

- Additive workflow migration applied to project-local PostgreSQL; existing bookings/payments retained.
- Production build, TypeScript check and ESLint passed for Phase 2.
- 172 unit tests across 19 files passed, including legacy flight fingerprint compatibility, source-spoofing rejection, consent/save failures, staff scopes, transitions, follow-up and stale-write checks.
- Local PostgreSQL integration passed claim/ownership, one-winner concurrent updates, manual-capture audit, evidence, finance restrictions and access revocation. Booking/payment counts were unchanged; disposable fixtures were removed.
- Chromium against the production build passed durable contact/transport capture with catalogue context, admin staff grant/revocation, sales claim/note/follow-up, cross-owner 404, finance contact/travel redaction and milestone recording, offline WhatsApp group capture, and 390/768/1024/1440 layouts without page overflow or browser page errors. Production authentication throttling was respected when creating test accounts. Browser tooling and fixtures are local test artifacts, not application dependencies.
- Existing Unsplash placeholder images encountered network/DNS failures during testing; the workflow checks passed, but this is not evidence that remote imagery loads reliably in the environment.
- No production migrations, environment publication, external customer messages or live payment operations were performed. The earlier audit and Phase 1 evidence remain historical baselines.


## Validation evidence — Phase 3

- Additive quote/version/acceptance/outbox/attempt and message-snapshot migrations applied to project-local PostgreSQL; existing booking/payment records retained.
- Production build, TypeScript checking, ESLint and the no-send worker dry run passed.
- 193 unit tests passed, including precise currency calculations, quotation field validation, nested-content hashing, document escaping, authorization and per-recipient legacy notification bookkeeping.
- Local quotation integration passed immutable revisions, concurrent issuance/acceptance, expired/superseded rejection, exact acceptance, delivery retries with stable idempotency, per-attempt records, concurrent worker leases, configuration blocks, uncertain-delivery review and revoked recipients. Transports were mocked; no external messages or money moved.
- Chromium against the production build passed the quote editor, responsive preview, historical HTML download equality, private-note exclusion, latest-version acceptance, cross-owner/finance denial, blocked-notification retry UI and cron authorization.
- Sender/provider inbox receipt, recurring scheduling, production migrations and business/policy approval remain deployment validation; no scheduler, service account or environment publication was activated. Existing booking/account emails remain best-effort, with corrected delivery timestamps.


## Validation evidence — Phase 4

- Additive finance, settlement, supplier and fulfilment migration applied to project-local PostgreSQL. Existing bookings and gateway attempts remain separate.
- 205 unit tests passed. Local finance integration passed concurrent split-allocation limits, idempotency, role revocation, pending/reconciled funds, funding thresholds, supplier approval and confirmation, supplier credits/recoveries, partial refunds, reversals, currency isolation and legacy booking-link safeguards. Fixtures were removed; booking/payment counts did not change.
- Production build, TypeScript checking and ESLint passed. Chromium passed admin finance, supplier and accepted-case screens at 390/768/1024/1440 widths without overflow or page errors, plus a pending-receipt form submission and finance/operations field redaction.
- Staff procedure, accounting definitions, corrections and limitations are documented in [FINANCE_AND_SUPPLIERS.md](FINANCE_AND_SUPPLIERS.md).
- Approved bank/mobile-money accounts, supplier contracts, actual statement checking and production business approval remain operational prerequisites. Pesapal activation remains deferred. No external money movement or environment publication was performed.
