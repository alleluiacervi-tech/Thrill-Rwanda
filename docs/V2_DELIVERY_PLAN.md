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

- [x] Flights-first homepage, service cards, how-it-works, FAQ and quote-led policy drafts.
- [x] Remove unsupported fixed rates, partner/driver credentials, Kenyan compliance/credit and response/refund promises from rewritten public flows; admin-authored content remains subject to business review.
- [x] Versioned service publication controls, request-only defaults, shared transport availability and server enforcement for new direct bookings/public capture.
- [x] Per-offer itinerary, suitability, inclusions/exclusions and exact-content approval; edits clear public approval.
- [x] Assigned support cases, next actions, escalation/resolution history and configurable public staffed-hours/escalation guidance.
- [x] Anonymous daily CTA counters and scoped cohort reports for source, elapsed response, acceptance, follow-up, unresolved/lost cases and supplier follow-through.
- [x] Scoped operations/finance CSV with formula protection, export audit and currency separation.
- [x] Static homepage rather than autoplay-first video; local navigation imagery and implementation checks for responsive layout, focus and form handling.
- [x] Local brand share-image generation, service metadata/hidden sitemap filtering and contact-link structure.
- [x] Production reset-token logging removed; fresh account access for sensitive actions and document/image endpoints.
- [x] Approved collection policy, retained-copy expiry, access audit and administrator deletion controls; operational retention/backup approval remains a release prerequisite.
- [ ] Business approval of all public copy, offers, media, metadata, contact ownership, support arrangements and legal/privacy/retention requirements.
- [ ] Staging audit acceptance, assistive-technology testing, target-device performance budgets and founder sign-off.

Procedure and remaining release checks: [PUBLIC_LAUNCH_SUPPORT_AND_REPORTING.md](PUBLIC_LAUNCH_SUPPORT_AND_REPORTING.md).

Gate: the [audit acceptance matrix](V2_IMPLEMENTATION_AUDIT.md#12-v2-acceptance-checklist-coverage) passes in staging against the approved launch service scope. Code completion does not satisfy the remaining business/staging gates.

## Phase 6 — operational release and handover

- [x] Explicit environment identity, configuration preflight, isolated PostgreSQL CI and private-preview access controls; real deployment/account separation remains an operational gate.
- [x] Consistent encrypted backup, authenticated manifest and guarded disposable restore test; all 56 table counts verified locally.
- [x] Deployment/rollback/incident procedures, health probe, protected worker heartbeats and readiness dashboard.
- [x] Admin/staff/customer guides, environment reference, current schema/export/retention instructions and known limitations.
- [x] Company-owned account/access/cost/renewal/evidence register with review expiry; actual owners and costs are recorded by the company, not fabricated.
- [x] Approval/evidence gates, invited-preview tooling and manual service review controls; no production publication or live channel activation.
- [x] README/architecture updated to the delivered software and validation scope.
- [ ] Provision and verify real staging/production databases, hosting, secrets, company-owned accounts, backup storage and operational owners.
- [ ] Approve brand/content/policies, supplier evidence, staffed support, retention/holds, external costs and account access.
- [ ] Activate and observe approved backup/worker/monitoring schedules; production restore/rollback exercise, staff walkthrough, staging acceptance and founder sign-off.

Gate: [Release and handover](RELEASE_AND_HANDOVER.md) evidence and the remaining external checks above. A record or passing local build does not publish or establish production readiness.

## Phase 7 — customer and corporate request workspaces

- [x] Explicit identity/authority/consent grants; no automatic guest-to-account or email-domain merge.
- [x] Customer request/immutable quote history and protected downloads, with private staff/cost redaction.
- [x] Authorized exact-version customer acceptance with expiry, current-access checks, concurrency and retry protection.
- [x] Duplicate-safe customer support requests routed to the current responsible staff owner.
- [x] Company workspaces with explicit membership and per-case sharing/revocation; acceptance authority remains separate.

## Phase 8 — supplier follow-through, quotation assistance and optional channels

- [x] Case-linked supplier performance scores, outcomes, evidence, corrective action and review dates.
- [x] Editable revision prefill from an integrity-checked previous quote, with fresh deadlines and human approval required.
- [x] Durable WhatsApp reference/status template adapter with explicit case opt-in, release/configuration gating, opt-out, stale-status cancellation and uncertain-send blocking.
- [x] Legal holds and dry-run-first scheduled document-retention tooling, with audited bounded deletion after explicit operational approval.
- [ ] Company-approved Meta account/template/costs and real recipient tests before enabling WhatsApp.
- [ ] A named supplier API, contract, sandbox, credentials and data-sharing/settlement approval before any live supplier integration. The existing checked fulfilment workflow remains the adapter-independent path.

Procedures: [Client portals and channels](CLIENT_PORTALS_AND_CHANNELS.md), [Environment reference](ENVIRONMENT_REFERENCE.md), [Release and handover](RELEASE_AND_HANDOVER.md).

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

## Validation evidence — Phase 5

- Two additive migrations applied to project-local PostgreSQL: service/operations policy, support, aggregate interactions/audit, per-offer content, and private-document deadlines. Existing booking/payment/quote history retained.
- 219 unit tests passed, including hidden public capture, publication restrictions, CSV formula handling, report date boundaries, immutable retention deadlines, production reset-log redaction and the interaction endpoint's host/privacy limits.
- TypeScript, ESLint and production build passed. The guarded launch integration passed publication approval/stale versions, support ownership/concurrency/idempotency/resolution/revocation, stale offer approval, document scope/expiry/read audit/deletion and fresh permission-scoped exports.
- Earlier flight, enquiry workflow, quotation and finance integrations also passed. All quotation transports were mocked; no messages, ticket issuance or money movement occurred.
- Chromium against the production build passed public and admin launch/support/report pages at 390/768/1024/1440 widths without overflow; no unsolicited homepage video downloads; anonymous click recording; local PNG share image; hidden-service route/navigation invalidation and restoration; keyboard menu Escape/focus return; support submission with retained validation-error input; scoped CSV and immediate session revocation. No browser page errors.
- Axe WCAG 2 A/AA and 2.1 AA scans found no serious/critical violations on the sampled home, transfer, corporate, how-it-works, support and cancellation pages. This is a limited automated check, not complete assistive-technology, content or performance certification. Browser/accessibility tools and screenshots are local test artifacts, not new application dependencies.
- Disposable records were removed and prior publication/policy records restored. Actual business approvals, staging sign-off, production migrations, retention review scheduling, operational accounts and publication remain pending. The Phase 6 handover/release gate is separate.


## Validation evidence — combined Phases 6–8

- Additive client/company access, supplier-review, release-evidence, worker-health, channel-consent and legal-hold migration applied to project-local PostgreSQL. Earlier enquiries, immutable quotes, bookings and separate financial ledgers retained.
- 229 unit tests passed, including backup encryption/authentication/corruption, restore target guards, readiness evidence expiry, sandbox/live payment boundaries, minimal WhatsApp template content and private-preview intake rejection. TypeScript, ESLint and production build passed.
- All six guarded PostgreSQL integrations passed sequentially: public captures, staff triage, quotations/outbox, finance/fulfilment, launch/support/reporting and client/release features. New checks include exact-version concurrent customer acceptance, no email auto-link, corporate case scope, cost redaction, support idempotency, live access revocation, mocked WhatsApp opt-in/configuration/uncertain-send behavior, supplier reviews and hold-aware scoped retention. Fixtures were removed; no external messages or money moved.
- Actual local PostgreSQL 17 backup/restore passed using a consistent AES-256-GCM archive, HMAC-authenticated manifest and matching counts for all 56 tables; foreign keys validated and the fresh restore database/plaintext/test artifacts removed. Error-path checks preserved an existing output file, removed failed artifacts, terminated child processes and did not log the encryption key. This is local evidence, not production recovery certification.
- Chromium passed admin readiness/company/supplier/staff pages and customer/company portals at 390/768/1024/1440 without page overflow/errors; exact-version acceptance, private HTML download, internal-cost exclusion, support submission, company cross-case denial, health response, live revocation and an independently running invited-preview instance. Sampled portal Axe checks found no serious/critical WCAG 2 A/AA or 2.1 AA violations. Tools/screenshots remain local test artifacts.
- Configuration preflight accurately reports missing local worker, email and persistent backup-key configuration; these were not fabricated or activated. A least-privilege GitHub validation workflow is committed, but its remote run and actual staging/production schedules/accounts require provider-side evidence.
- Remaining items are real business/account/API approvals, external infrastructure/schedules/provider delivery, production restore/rollback, final walkthrough/staging/founder sign-off and publication. No deployment, environment publication, live gateway, Meta account, supplier API or paid service was activated.
