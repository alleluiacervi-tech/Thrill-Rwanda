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

- [ ] Add enquiry status model: New, Contacted, Needs more information, Quote sent, Awaiting payment, Partner processing, Booked/confirmed, Completed and separate terminal/outcome handling.
- [ ] Add owner, next follow-up, first response, notes/activity timeline and reason fields.
- [ ] Add conflict-safe edits, validated transitions and immutable sensitive-change audit events.
- [ ] Extend staff permissions for sales, operations and finance; do not give all staff ADMIN access.
- [ ] Add lead board, owner/status/service/source filters and overdue queue using existing dashboard/table components.
- [ ] Add manual lead capture for phone, WhatsApp, referrals, social and organization outreach.
- [ ] Add service-aware trip, stay, transport, group and optional event forms using the shared enquiry core.
- [ ] Move contact/corporate requests from email-only capture into durable enquiries, preserving selected catalogue context.
- [ ] Link guest/customer contacts carefully; provide staff enquiry history without requiring public signup.

Integration with prior work: use current session guards and admin shell, extend permissions centrally, keep provider scoping, and adapt catalogue CTAs only after the approved service-mode policy is enforced. Guest data must never become publicly searchable by reference alone.

Gate: staff can assign, contact, record notes, schedule follow-ups and handle an approved service lead without personal email/WhatsApp being the only record. Authorization and concurrent-edit tests pass.

## Phase 3 — written quotes and reliable communication

- [ ] Quote/version/items schema; immutable issued snapshots and expiry/payment deadlines.
- [ ] Supplier conditions/baggage, service description, dates, currency/tax and approved fee breakdown.
- [ ] Separate internal supplier economics from customer-facing quotation fields.
- [ ] Staff editor, preview, issue/share and revision history; attach written quote if PDF automation is deferred.
- [ ] Acceptance evidence bound to the exact issued version; handle expired/revised quotes explicitly.
- [ ] Transactional outbox or equivalent durable notification jobs with per-recipient outcome, retries and safe staff alerts.
- [ ] Customer acknowledgement and staff-owner notifications through approved channels only.
- [ ] Repair existing notification `sentAt` bookkeeping so one recipient's successful send cannot mark other attempts as sent.
- [ ] Add quote PDF automation if selected; consistent written quotes are required regardless.

Integration with prior work: reuse branded email rendering/templates and inbox UI, but do not assume best-effort booking notifications satisfy durable lead delivery. Sending a quote is not booking confirmation.

Gate: staff can issue/revise a reproducible quotation, record exact acceptance and recover notification failures without losing the lead or showing false success.

## Phase 4 — approved payments, supplier fulfilment and finance

- [ ] Approved off-site payment instructions and receipt/reference capture.
- [ ] Permission-scoped reconciliation, duplicate receipt protection, partial allocations and reversals.
- [ ] Separate collections, supplier/ticket payable, retained fees/commission, charges, refunds and contribution by currency.
- [ ] Supplier register or controlled internal register: categories, contacts, agreements/rate sheets, service areas, restrictions, escalation and publication permission.
- [ ] Supplier processing and checked confirmation/ticket reference; issuance remains with the authorized ticketing partner.
- [ ] Explicit link from accepted/reconciled enquiry to a fulfilled booking/service record where needed; preserve legacy bookings and gateway attempts.
- [ ] Refund/cancellation obligations tracked independently of a simple cancelled status.
- [ ] Update reporting terminology: customer collections are not retained revenue or profit.
- [ ] Validate payment search against `Payment.idempotencyKey` rather than the absent schema field `merchantReference`.
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

The flight form is dynamically rendered so each page load has a fresh submission token; retries of the same form retain its key. PostgreSQL persists submissions before success is shown. This slice does not send email/WhatsApp, implement staff workflow transitions, or globally disable existing direct-booking services. Until later gates are met, do not represent the entire site as a launch-ready Version 2 platform.

## Validation evidence — first implementation slice

- Prisma client generation and all 21 committed migrations applied successfully to project-local PostgreSQL, including the additive enquiries migration.
- `npm test`: 15 test files / 138 tests passed, including existing booking/settings tests and new schema, persistence and server-action failure cases.
- `npm run lint`, `npm run typecheck` and production `npm run build`: passed. The final build includes the corrected PostgreSQL lock query and form retry handling.
- `npx tsx scripts/check-flight-enquiries.ts`: passed real PostgreSQL concurrent duplicate submission, payload mismatch, concurrent contact-rate limit, consent persistence and no-booking/no-payment checks. Test records removed.
- Local Chromium/Playwright smoke test against the production build: passed phone-only guest submission; invalid-route error with retained values/consent and no saved row; corrected retry with saved reference; anonymous redirect; signed-in CUSTOMER denial; ADMIN inbox/detail and consent evidence; widths 390/768/1024/1440 without page overflow; no browser page errors. Disposable test account and request removed. Browser tooling was installed outside the checkout for this smoke test and is not a new project dependency or a committed browser test suite.
- No production database changes, environment configuration updates, publishing, external customer messages, or live payment tests were performed. These checks validate the first slice, not all V2 acceptance criteria or full accessibility/security compliance.
