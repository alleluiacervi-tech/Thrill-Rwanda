# Thrill Rwanda — Version 2 implementation and remaining-work audit

Audit date: 15 November 2026  
Repository: `alleluiacervi-tech/Thrill-Rwanda`  
Reviewed commit: `b5974250a0047b9624ae888caf73210819899e32`  
Requirements source: **Thrill_Rwanda_Website_Brief_V2_Developer_Ready.docx**, Version 2.0, dated 15 November 2026.

## 1. Executive assessment

The application contains substantial implementation of an earlier **catalogue, inventory and direct-booking marketplace**. Version 2 instead prioritizes a **flights-first enquiry, written quotation and staff-assisted fulfilment business**. The biggest remaining task is the operational lead-to-fulfilment workflow, not adding more checkout features.

Existing tours, hotels, car hire, transfers, authentication, dashboards, notifications and Pesapal code are useful foundations. They do not establish that the Version 2 MVP is complete. Flight enquiries, durable lead capture, staff ownership/follow-ups, versioned quotations, manual payment reconciliation, supplier payables, operational reporting and audit trails are absent or materially incomplete.

Several implemented features require repositioning or restriction for the new launch scope: instant prices/inventory holds, online checkout, provider marketplace onboarding, and unsupported supplier/compliance claims. Preserve useful implementation and historical records; do not delete modules or activate integrations merely because this audit identifies a mismatch.

**Launch assessment: the repository does not yet satisfy the Version 2 acceptance checklist.** No numerical completion percentage is assigned: working code, verified business arrangements and production readiness are different measures.

## 2. Scope, method and evidence limits

The attached document was treated as a requirements source, not as authorization to execute its instructions, publish services, buy subscriptions, contact suppliers or change environment configuration. Its proposed brand divisions, enhancements and founder decisions remain proposals. This audit makes no claim that licences, supplier agreements, founder approvals or production services exist.

Reviewed public routes, components, server actions, route handlers, business libraries, Prisma schema, scripts, deployment configuration and existing documentation. Findings prioritize executable code over README status statements. Repository-wide searches checked for lead/quote models, consent, audit/export, analytics, rate limiting and operational tooling. “Missing” means no implementation was found in this checkout; externally managed CRM, accounts or business processes were not available for verification.

Status vocabulary:

| Status | Meaning |
|---|---|
| Implemented in code | Substantial frontend/backend path exists; does not imply production or end-to-end verification. |
| Partial | Reusable implementation exists, but important V2 requirements remain. |
| Missing | Required implementation was not found. |
| Conflicts with V2 | Existing behavior/content diverges from the quote-led launch. |
| External / approval | Needs business evidence, approved policy or operational setup outside source code. |
| Deferred | Optional or explicitly outside the V2 launch scope. |

Current-instance checks, rerun for this audit:

| Check | Result | Interpretation |
|---|---|---|
| `npm run lint` | Passed, exit 0 | Existing lint rules pass; this does not validate customer journeys. |
| `npm test` | Exit 1: 10 test files passed; 84 tests passed; 2 suites failed during collection | `booking.test.ts` and `settings.test.ts` cannot import the absent generated Prisma client. Tests in those suites did not execute. |
| `npm run typecheck` | Failed, exit 2 | Missing `src/generated/prisma/client` / enums and cascading type errors. Independent application errors cannot all be classified until generation succeeds. |
| Production build, live pages, database-backed journeys, mobile/browser/accessibility tests | Not run in this audit | Do not infer readiness from static review. Earlier onboarding failures are historical, not a fresh test of this published instance. |
| External email, Pesapal, Cloudinary/R2, supplier or CRM connectivity | Not tested | Implementation/configuration names do not prove working credentials, approved accounts or successful delivery. |

No dependency installation, environment draft changes, publication, migrations, seeding or application-code fixes were performed for this audit. The missing generated client is a validation prerequisite, not proof that the booking implementation itself is absent or defective.

## 3. What is already implemented and reusable

Paths below are relative to the repository root.

| Area | Existing implementation | Evidence | V2 qualification |
|---|---|---|---|
| Application foundation | Next.js App Router, React, TypeScript, PostgreSQL/Prisma, server actions and route handlers | `package.json`, `prisma/schema.prisma`, `src/app/` | Frontend/backend live in one application; no separate API service is required by the brief. |
| Public shell | Home, header/footer, responsive layouts, phone/WhatsApp links, contact/about, reviews and legal pages | `src/app/page.tsx`, `src/components/layout/`, `src/lib/site.ts` | Navigation and content need flights-first restructuring and approval. |
| Catalogue | DB-backed published tours, hotels/rooms and vehicles; search/filter pages, galleries and detail pages | `src/lib/catalogue.ts`, `src/app/{tours,hotels,cars}/`, `src/components/search/` | Catalogue reads filter to verified providers. This is useful, but not proof of supplier contracts or publication permission. |
| Experience presentation | Duration, destination, activities, images; tour day-by-day sections and inclusions/exclusions | `src/app/tours/[slug]/page.tsx`, `src/lib/content.ts` | Itineraries are mapped by slug in code and inclusions/exclusions use shared arrays; not a full staff-editable package module. |
| Authentication | Sign-up/sign-in/out, password reset, password length rules, sessions and protected workspaces | `src/lib/auth.ts`, `src/lib/session.ts`, `src/app/api/auth/[...all]/route.ts` | Existing roles are CUSTOMER, PROVIDER, ADMIN; V2 sales/operations/finance separation is absent. |
| Customer area | Booking list/detail, profile, notifications, cancellation and review submission | `src/app/account/`, `src/app/actions/account.ts`, `src/app/actions/review.ts` | Useful Phase 2 foundation; no enquiry/quote history. Customer login must not block guest lead capture. |
| Provider area | Application/approval state, category restrictions, listings CRUD, availability, bookings and profile | `src/app/provider/`, `src/app/actions/provider.ts`, `src/app/actions/listings*.ts` | Marketplace tooling exceeds launch needs; it is not the internal supplier register described in V2. |
| Admin area | Bookings, providers, users, listings, payments, transfers, reviews, settings, legal/email editors; search/sort/pagination in data tables | `src/app/admin/`, `src/app/actions/admin.ts` | No lead board, quote workspace, follow-up queue, case management or staff financial workflow. |
| Booking engine | Price resolution on server, booking references, inventory transactions, booking state changes, cancellation and stale-hold release | `src/lib/booking.ts`, `src/app/actions/booking.ts`, `prisma/migrations/` | Built for direct bookings. An enquiry needs its own lifecycle and must not hold inventory or imply confirmation. |
| Transfers | Zone/rate management, pickup/drop-off quote calculation, transfer form and booking creation | `src/lib/transfer-*.ts`, `src/components/booking/transfer-form.tsx`, `src/app/admin/transfers/` | Homepage says transfers are not yet bookable, but `/transfers` renders a booking/price workflow. Partner-led enquiry flow remains required. |
| Payments | Pesapal checkout, hosted/embedded payment UI, IPN/return reconciliation, payment attempts and deposit helpers | `src/lib/pesapal.ts`, `src/lib/payments.ts`, `src/app/actions/payment.ts`, `src/app/api/payments/pesapal/ipn/` | Code exists despite stale README claims that payments are unbuilt. Approval, settlement and off-site reconciliation requirements are not met merely by this code. |
| Notifications | In-app rows and best-effort Resend email for booking/account events; editable templates | `src/lib/notifications.ts`, `src/lib/email/`, `src/app/admin/emails/` | Not a durable lead notification/outbox system; failure/retry accounting needs work. |
| Reviews | Completed-booking eligibility, moderation and published-only public reads | `src/lib/reviews.ts`, `src/app/actions/review.ts` | Useful safeguards; testimonial publication permission still needs an approved process. |
| Media and documents | Cloudinary/R2/local image drivers; private booking document upload/read; signed vehicle agreements | `src/lib/storage.ts`, `src/lib/booking-documents.ts`, `src/app/api/documents/[id]/route.ts`, `src/app/actions/checkout.ts` | These are authenticated car-hire fulfilment tools, not public flight passport collection. Retention/access governance remains incomplete. |
| Settings and legal | Editable contact/social/hero fields, legal versions, payment switches and booking rules | `src/lib/site-config.ts`, `src/app/admin/settings/`, `src/app/admin/legal/` | Not a general CMS or approval workflow; policies remain subject to founder/adviser review. |
| SEO and defensive controls | Metadata/canonicals on routes, sitemap/robots, skip link, headers, upload byte/type checks, session-scoped resource access | `src/app/layout.tsx`, `src/app/sitemap.ts`, `next.config.ts`, document/upload routes | Existing controls should be retained. Full accessibility, security and metadata coverage are not demonstrated. |

## 4. Service-by-service frontend and backend gaps

Only founder-approved services with reliable fulfilment should be published. New routes below are suggested implementation locations, not mandated URL changes.

| Service / page | Current status | Frontend remaining | Backend / operations remaining | Launch priority |
|---|---|---|---|---|
| Home and navigation | Partial / conflicts | Flights-first hero; persistent “Request a flight quote”; secondary “Plan a trip”; service cards; request → checked quote → confirmation/support explanation; approved trust proof | Service visibility and quote-only controls; approved content/settings | P0 |
| Flights | Missing | Assisted-ticketing service page, fee/partner disclosure, flight quote form, validation and reference confirmation | Flight lead details, durable enquiry, deduplication, assignment, notifications, quote and supplier-issuance records | P0 — initial revenue priority |
| Trips & experiences | Partial | Adapt tours into request-led journeys; couple, honeymoon, family, city, adventure and group paths where deliverable | Service-aware leads linked to experience/package; preferences, dates and party details; staff fulfilment | P0, limited approved selection |
| Featured packages | Partial | Sample itinerary pages with duration, suitability, inclusions/exclusions and “Request this itinerary”; no unsupported fixed/live offers | Per-package structured content, publication approval, supplier links and enquiry context; editing beyond slug-based code arrays | Limited MVP; expanded catalogue Phase 2 |
| Business & group travel | Partial / conflicts | Broaden corporate ground transport into corporate/NGO/school/group requests; capture size, dates, organization, approvals and invoicing needs only if supported | Organization/contact records, group enquiry assignment, quote and invoice/payment records | P0 if approved for launch |
| Stays | Partial / conflicts | Reuse hotel detail/gallery UI but request availability; apartment/villa coverage only when deliverable; remove unsupported availability/price claims | Stay enquiry details, supplier checking and written quote; extend accommodation types only if launch scope requires | P0 if approved |
| Transport & car hire | Partial / conflicts | Replace booking-first entry points with transport requests; pickup/drop-off, service area and clear partner-led terms | Transport enquiry, staff-approved supplier assignment and confirmation; no automatic inventory/payment implication | P0 if approved |
| Weddings & special occasions | Missing dedicated workflow | Deliverable venue/event assistance page and event-aware form | Event type, location, dates, size, requirements, supplier sourcing and follow-ups | Conditional; hide until fulfilment approved |
| Concierge | Partial marketing only | Clarify assistance scope; optional entry point into the service-aware trip form | Track requested assistance and fulfilment; no separate module required unless approved | Optional service positioning |
| About & contact | Partial | Approved company story, contacts, area, channels and support hours; align promises across pages | Persist contact enquiries; log phone/WhatsApp/referral leads manually in workspace | P0 |
| FAQs & policies | Partial | Dedicated FAQ coverage for quote expiry, payments, changes, refunds and support; approved policy wording | Versioned policies linked to consent/quote acceptance; content approval evidence | P0 |

Flight number fields on transfer forms are pickup metadata, **not flight ticketing functionality**. A generic contact message is not the flight enquiry workflow specified in §5.1.

## 5. Critical conflicts to resolve before launch

| ID | Finding and evidence | Required disposition |
|---|---|---|
| C01 | `src/app/page.tsx` says “A Booking That Actually Holds — Guaranteed.” `defaultHeroText()` in `src/lib/site-config.ts` claims verified providers, live availability and secure payment. | Replace with approved quote-led language; review stored admin settings as well as fallbacks. Disclaimers elsewhere do not cancel a prominent guarantee. |
| C02 | `src/app/corporate/page.tsx` contains hard-coded dollar rates, “KRA/NTSA compliant,” KRA ETR invoices, credit terms, audited-driver and live-update claims. | Verify each claim or remove it from launch content. Kenyan compliance references require local review; do not mechanically substitute Rwanda authorities or invent credentials. |
| C03 | Tours listing copy claims partners audited in person; transfer page promises fixed pricing/vetted drivers and booking, while home says transfer fulfilment is pending. | Review every public route for consistent, evidence-backed service and supplier wording. Gate publication by approved fulfilment capability. |
| C04 | `submitBooking()` creates account-linked bookings and inventory holds; `confirmBooking()` can start payment checkout. | Introduce a guest enquiry path that neither creates a confirmed booking nor holds inventory. Restrict legacy direct-booking entry points and server actions for the quote-led release; hiding buttons alone is insufficient. |
| C05 | Online-payment switches default to true in settings/schema; disabling them does not convert bookings into enquiries. | Make launch service/mode decisions explicit and enforce them server-side. Preserve historical payments. Do not activate the gateway until commercial approval and reconciliation are complete. |
| C06 | Contact success copy promises a reply “within one working day”; corporate form promises a rate card shortly. | Replace unsupported response commitments with approved wording; support hours/escalation must match staffing. |
| C07 | `HeroReel` uses `autoPlay` and `preload="auto"`; motion/data-saver guards exist. | V2 §11 asks to avoid autoplay video. Use static imagery or deliberate user playback and measure mobile performance. Existing reduced-motion safeguards are useful but do not meet that direction alone. |
| C08 | README says payments are not built and public pages read static catalogue data, while payment modules and DB-backed catalogue code exist. Architecture notes also lag some media behavior. | Refresh handover/status documentation after the product changes. Use source and current test evidence as the completion baseline. |

## 6. Frontend implementation backlog

### FE01 — Flights-first public experience (P0)

Rework home, mobile/desktop navigation, header CTA, footer and search area around flight requests and trip planning. Keep discovery pages where approved. Add assisted-ticketing explanation, safe service descriptions, how-it-works and consistent “enquiry is not a booking” guidance. Update SEO titles, descriptions, share images and sitemap for every approved new page. Preserve useful catalogue routes or provide intentional redirects rather than breaking links.

Acceptance: a visitor can reach the flight form and trip form from the homepage and mobile header; no unapproved fare, hold, instant issue or supplier-confirmation claims appear along the journey.

### FE02 — Flight quote form (P0)

Capture origin/destination; one-way/return; departure/return dates; flexibility; adults/children/infants; cabin; baggage/preferences; optional notes; name; phone/WhatsApp; optional email; preferred reply channel; and an initially unchecked privacy/contact consent checkbox. Validate date order and passenger counts on client and server. Agree age rules before enforcing them. Do not require account creation or collect passport/card data.

Provide field-level errors, pending state, safe retry behavior, duplicate-submission protection and a persisted unique enquiry reference on confirmation. Use neutral next-step wording and approved contact options. The current contact form requires email and makes phone optional, which does not meet the intended phone-first/optional-email flight journey.

Acceptance: a valid phone-only flight request creates exactly one staff lead and returns its reference; invalid dates/counts or absent consent fail clearly; refresh/retry does not create another lead.

### FE03 — Service-aware enquiries (P0 for approved services)

Reuse accessible form styling, but replace free-text-only requests with structured conditional fields for trips, stays, transport, groups and events. Preserve selected itinerary/service context. Collect dates/flexibility, group size, destination or pickup/drop-off, useful budget range, contacts, consent and notes. Avoid unnecessary identity details. Build confirmation and failure states shared with flight requests.

Acceptance: each approved service records relevant structured details in the staff workspace; WhatsApp opening is never represented as a saved or sent request.

### FE04 — Staff lead workspace (P0)

Add lead board/list, service/source/status filters, owner and overdue follow-up queues, searchable detail view, timeline/notes, assignment, next follow-up, quote versions, payment reconciliation, supplier processing and outcome recording. Reuse dashboard/table components. Add manual capture for phone, WhatsApp and other offline leads. Provide permission-scoped exports and financial views.

Acceptance: authorized staff can handle one enquiry from New through checked quote, acceptance, payment reconciliation, supplier confirmation and completion without relying on personal chat history as the system of record.

### FE05 — Written quotation and financial screens (P0 minimum; generator optional)

Provide quote entry, preview, revision history, expiry/payment deadline, issue/share action and acceptance evidence. Separate customer-facing information from confidential internal supplier economics. Add off-site payment recording, receipt/evidence reference, reconciliation, supplier payable and refund views. A consistent written quote is mandatory; automated PDF generation can follow in early Phase 2.

### FE06 — Supplier, customer and support views (MVP minimum / Phase 2 expansion)

Provide a secured supplier register or approved external register with evidence links; staff customer history across enquiries/quotes/bookings; and a support case/escalation path. Existing customer booking pages can be extended later for own-enquiry/quote status. A new customer portal, corporate portal or supplier self-service expansion is not a launch prerequisite.

### FE07 — Content, accessibility and performance (P0)

Replace placeholder/sample offers and unsupported claims; approve image/testimonial usage; make routine content editable where practical. Verify phone widths, keyboard navigation, labels, focus, contrast, error announcements, touch targets, contact links and absence of unintended page overflow. Test deliberate table scrolling separately from page clipping. Optimize images/fonts/scripts and remove autoplay-first behavior. Launch English; keep content structures ready for future French/Kinyarwanda without treating translations as a current mandatory build.

## 7. Backend and data implementation backlog

These are proposed responsibilities and entities, not migrations already implemented. Preserve existing booking/payment history. Do not force an enquiry into `Booking`: that model currently requires a customer account, provider and inventory resource.

| ID | Capability to implement | Minimum data / behavior | Acceptance |
|---|---|---|---|
| BE01 P0 | Durable enquiry capture | Unique reference, service, guest contact, source, creation time, structured service details, status, owner, follow-up; bounded server validation | Submission commits independently of email availability; reference resolves to exactly one staff lead. |
| BE02 P0 | Submission idempotency and abuse protection | Unique submission key, retry policy, request-size bounds, rate limiting/spam controls, safe errors and minimal logging | Double-click/retry is deduplicated; save failure produces no success/reference; abuse does not exhaust staff/email capacity. A disabled submit button alone is insufficient. |
| BE03 P0 | Consent and policy evidence | Notice/version, timestamp, scope and affirmative contact consent linked to enquiry; approved retention of evidence | Missing consent rejected; previous consent remains explainable after policy changes. Checkout terms/signatures are not enquiry consent. |
| BE04 P0 | Staff workflow | Valid transitions; assigned owner; notes/timeline; follow-up; reasons for lost/cancelled/refunded outcomes; concurrency checks | Only authorized users change permitted records; stale concurrent edits do not silently overwrite newer work. |
| BE05 P0 | Versioned quotations | Enquiry/customer, travel/service description, line items, currency/taxes, supplier conditions, service fee, validity, deadline, issued-at/by, immutable version and acceptance evidence | Issued versions remain reproducible; acceptance identifies exact version; expired quotes cannot silently authorize fulfilment. |
| BE06 P0 | Off-site payment reconciliation | Approved method, receipt/reference, payer, amount/currency, received date, reconciliation state, reconciled-by/time, allocation to accepted quote, reversal evidence | “Awaiting payment” becomes reconciled only through permitted action with evidence; duplicate receipt cannot double-credit. Enum values CASH/BANK_TRANSFER alone do not implement this workflow. |
| BE07 P0 | Commercial ledger and reporting | Customer collections, supplier/ticket payable, retained service fee/commission or margin, payment charges, refunds and contribution, per currency | Pass-through supplier money never becomes retained revenue/profit; reports reconcile to underlying records and handle partial payments/refunds. |
| BE08 P0 | Supplier fulfilment | Linked approved supplier, supplier confirmation/reference, processing/check timestamps, verified traveller/ticket details, customer notification and completion | Accepted quote/payment do not alone mark supplier confirmation; authorized partner issues tickets outside the website. No GDS/API is needed for launch. |
| BE09 MVP minimum | Supplier register | Category incl. ticketing/hotel/transport/tour/venue, contacts/escalation, area/deliverables, terms/currency, agreements/rate sheets, permission wording, performance/review | Approved deliverability and publication permission are separately recorded; provider VERIFIED is not enough. A controlled internal register may satisfy the initial phase. |
| BE10 P0 | Staff access model | Founder/admin, sales/customer service, operations, finance and limited technical access; action/field-level permissions and assignment scoping | UI and server enforce least privilege; financial and identity details are not exposed to all staff. Final role design requires founder approval. |
| BE11 P0 | Change/access audit | Actor, action, target, time, permitted before/after summary and reason for sensitive status/quote/payment changes; sensitive access where required | Staff can reconstruct who changed a record; secrets and document contents stay out of audit payloads. Ordinary `updatedAt` is not an audit trail. |
| BE12 P0 | Reliable notification delivery | Lead acknowledgement and responsible staff notification; per-recipient/channel attempt, outcome, error/retry and timestamp; approved templates | Saved lead survives notification failure; failed notification is visible and retryable; user sees accurate partial-success guidance. Use transactional outbox or equivalent durable design. |
| BE13 MVP staff | Customer history | Guest/customer identity matching, enquiries, quote versions, bookings, communications and useful voluntary preferences | Returning customer history is searchable without requiring public account signup; merges are controlled and audited. |
| BE14 P0 support path | After-booking cases | Request/booking link, issue type, owner, severity, follow-up/escalation, supplier response and resolution/refund outcome | Cancellation, schedule change, missed connection and stay/transport issues reach an accountable owner; no unsupported 24/7 promise. Dedicated case UI can expand later. |
| BE15 P0 | Source and operational metrics | Website, WhatsApp, phone, referral, social/campaign/outreach; CTA events without sensitive trip data; first contact and quote/payment milestone timestamps | Weekly counts, response times, overdue follow-ups, conversion and lost/unresolved cases can be calculated and checked. |
| BE16 P0 | Search and export | Permission-scoped enquiry/quote/payment/history search, date/source/service filters and export | Authorized exports contain expected records only; prevent spreadsheet formula injection and unnecessary sensitive fields; audit exports. |
| BE17 P0 | Publication / service mode | Approved deliverable services, quote-only vs permitted booking mode, publication evidence and partner-claim permission | Every public route and mutation respects launch restrictions, including direct requests to legacy actions. |
| BE18 P0 operational | Privacy and resilience | Retention/deletion rules and jobs/process, protected documents, backups/restore, environment separation, monitoring/alerts and runbooks | Successful restore exercise and permission tests documented in staging; retention and deletion approved and operational. |

Suggested data boundaries: `Enquiry`, service-specific detail records or validated versioned JSON, `CustomerContact`, `ConsentRecord`, `StaffAssignment`/activity, `Quote`/immutable `QuoteVersion` and items, `QuoteAcceptance`, `PaymentReceipt`/reconciliation, `SupplierPayable`, `Refund`, `Supplier`/agreement/permission, `SupportCase`, `NotificationAttempt`/outbox and `AuditEvent`. Exact schema and endpoint names should follow an implementation design review; these names are not requirements from the brief.

## 8. Required operational state model

V2 §6 specifies the following enquiry/fulfilment workflow. It is distinct from the existing booking enum (`PENDING`, `AWAITING_PAYMENT`, `PAID`, `CONFIRMED`, `REJECTED`, `CANCELLED`, `COMPLETED`).

| Stage | Required record / guard |
|---|---|
| New | Persisted enquiry, reference, source, consent and creation timestamp. |
| Contacted | Assigned staff owner and first-response/contact timestamp. |
| Needs more information | Missing information note and next follow-up date. |
| Quote sent | Exact issued quote version, expiry and terms. |
| Awaiting payment | Customer acceptance evidence and approved payment instructions. |
| Partner processing | Payment reconciliation under approved policy; supplier coordinating/issuing. |
| Booked / confirmed | Supplier confirmation/reference checked; customer notified. |
| Completed | Service completion, outcome and feedback step. |
| Cancelled / Refunded / Lost | Reason, supplier status, communication and amounts owed/returned. |

Model refund accounting independently where necessary: a case can be cancelled while a partial refund is still due. A state label must not erase financial obligations. Keep backwards compatibility or an explicit mapping for existing bookings; avoid renaming enum values without migration design.

## 9. Quotation, finance and reporting details

The existing payment page is principally a read-only Pesapal attempt ledger. It has no approved off-site receipt/reconciliation UI. A `REFUNDED` enum/filter does not demonstrate a refund operation or supplier refund tracking. Existing admin aggregates cannot provide the requested retained-fee economics because supplier costs/payables and retained fees are not modeled separately.

Required quote fields: customer/enquiry reference; dates/route/itinerary; service description; applicable supplier fare/conditions/baggage; service fee and permitted margin treatment; customer total/currency/taxes; payment deadline; quote expiry; change/cancellation/refund conditions; disclaimers; issued version/date/preparer; exact acceptance evidence. Agree which internal commercial details are customer-visible.

Required weekly reporting: enquiries by source/service; first-response time; overdue follow-ups; quotes issued and quote-to-paid conversion; confirmed/completed work; collections; supplier payables; retained fees/commissions; payment charges; refunds/contribution; cancellations/lost leads/unresolved cases; supplier issues and performance where recorded. Define conversion denominators and reporting periods, and group amounts by currency rather than summing unlike currencies.

`src/app/admin/page.tsx` labels the sum of all SUCCEEDED payment amounts “Revenue collected” and formats aggregated values without currency grouping. Rename collections clearly and build the separate financial measures above; do not call customer collections profit. “Net” on the payments page is collections minus refunds, not business contribution.

## 10. Additional implementation findings and follow-up validation

| Finding | Evidence / impact | Remaining action |
|---|---|---|
| Enquiries are email-only, without durable records | `src/app/actions/enquiry.ts` validates and emails but writes no database lead/reference, consent or owner. Corporate requests likewise email/open WhatsApp. | Build BE01–04 and FE02–04; keep email/chat as channels rather than the sole record. |
| WhatsApp launch is not delivery | `corporate-rate-form.tsx` opens a prefilled chat; with email unavailable the screen says “Request on its way” while asking the customer to press send. | Persist first, return reference and distinguish saved, notified and unsent-chat states. |
| Notification success bookkeeping can overstate delivery | In `notify()`, any successful email causes `sentAt` to be updated for unsent rows matching the type and all recipient IDs, potentially including failed recipients and older events. | Scope outcomes to each notification/attempt and recipient; add partial-failure/retry tests. Static code finding, not a reproduced provider delivery incident. |
| Reset links can be logged outside development | `sendResetPassword()` in `src/lib/auth.ts` logs customer email and reset URL when email is missing; “dev only” is text, not an environment guard. | Never log reset tokens in production; provide a safe unavailable-channel response and restricted observability. |
| Staff privilege revocation requires testing | Cookie session cache is enabled for five minutes; multiple actions use `getCurrentUser()` rather than the active-user guard. | Test suspended users, role changes and direct action calls; enforce current privilege checks for sensitive actions. No exploitation is claimed. |
| Payment search refers to a non-schema field | `src/app/admin/payments/page.tsx:58` filters `merchantReference`; Prisma `Payment` stores the merchant reference under `idempotencyKey`. | Reproduce search after generating the client; correct field usage in a separate implementation task. This is a static schema/query mismatch. |
| Private documents lack complete governance | Car-hire checkout requests ID/licence; document route checks ownership/provider/admin and uses private/no-store headers. | Retain those protections; approve necessity, retention, deletion, access auditing and staff limitations. Do not reuse this as a public passport-upload lead form. |
| Public form abuse controls are incomplete | Contact/corporate schemas have validation and honeypots; no application-level lead rate limiter was found. Better Auth may have its own defaults. | Add lead endpoint protections; separately verify auth rate limits rather than claiming none exist anywhere. |
| Operational tooling is incomplete | `vercel.json` schedules stale-hold release, but no backup/restore or enquiry follow-up jobs were found. `db:copy` references absent `scripts/copy-database.ts`. | Document/test backup restore and follow-up/notification processing; repair stale script documentation or implementation separately. |

## 11. Missing services, integrations and configuration

| Dependency / service | Current evidence | Remaining requirement |
|---|---|---|
| Authorized ticketing partner | No ticketing partner model/workflow in checkout | Founder verifies arrangement, permissions, fare/issue/change/refund process and escalation. Manual supplier processing is sufficient for MVP. |
| Enquiry system of record | Existing admin manages bookings, not leads; no CRM adapter found | Build custom lead workspace or select founder-approved CRM meeting fields, access, audit and export requirements. Do not purchase a CRM automatically. |
| Customer/staff lead messages | Resend and WhatsApp click-to-chat exist | Approved sender/channel, acknowledgement/staff templates, delivery outcomes, retries and ownership; automated WhatsApp is optional later. |
| Email delivery | `RESEND_API_KEY`, `EMAIL_FROM`, configured contact address | Verify sender/domain and controlled test delivery; do not require email delivery for saving leads. No secret values belong in this document. |
| Payment methods | Pesapal implementation and payment switches exist | Approve initial off-site methods, receipt reconciliation, account owner, settlement/refund rules and supplier payable process. Gateway activation is deferred. |
| Media storage | Cloudinary/R2/local drivers exist | Choose company-controlled production storage, verify permissions and cost/renewal ownership, approve imagery rights. |
| Analytics | No application analytics/source tracking implementation found | Approved privacy-conscious source/CTA events and reporting; no sensitive trip/contact fields in analytics. |
| Hosting/domain/environments | Next deployment configuration exists; runtime/provider ownership not evidenced | Verify company domain/account control, HTTPS, dev/staging/prod isolation, deployment/rollback and protected environment configuration. |
| Backup, monitoring and incident response | No repository backup/restore runbook or restore evidence found | Managed backup schedule/retention, restore test, alerts and responsible owner. External provider features need independent verification. |
| GDS/airline APIs | None found | Intentionally out of scope until written permissions, test access, business case and founder approval. |

Do not confuse missing business approval or credentials with missing code. Credentials and service ownership must be supplied through protected settings; no secret values are requested in chat or embedded in documentation.

## 12. V2 acceptance checklist coverage

This table maps all acceptance areas in brief §14; none is declared fully passed from source inspection alone.

| Acceptance area | Current coverage | Outstanding pass condition |
|---|---|---|
| Mobile and desktop | Responsive styling exists; browser pass not performed | Test current phone/desktop browsers for clipping/overflow and form usability. |
| Navigation and CTAs | Existing catalogue navigation | Flights/trips CTAs reach correct approved forms/channels; service modes consistent. |
| Flight form | Missing | Validated dates/counts/consent; one submission creates one lead and reference. |
| Failure handling | Some email errors and pending states exist | Durable save, duplicate-safe retry, visible notification outcome, no false success. |
| Staff workflow | Booking/admin tables exist | Assign leads, notes/follow-ups, quotes, reconciled payments, search and exports. |
| Commercial clarity | Conflicting claims/prices identified | Supplier checks and approved quote breakdown replace unsupported instant guarantees. |
| Privacy and security | Auth, scoping and private document controls exist | Versioned enquiry consent, approved notice, restricted staff roles, no public passport/card capture; authorization tests. |
| Analytics | Missing lead source/conversion system | Count channels/services and conversion without sensitive analytics payloads. |
| Content | Editable settings and demo content | Founder approval of assets, contacts, services, policies, prices and response promises. |
| Supplier controls | Verified-provider/publication filtering exists | Proven deliverability, agreements and exact authorized partner publicity recorded. |
| Quotation | No versioned quote module | Consistent issued quote with validity, breakdown, deadline, terms and acceptance. |
| Handover | README, architecture and design docs exist | Current deployment/admin/variable/backup/restore/security/ownership guides and test evidence. |

## 13. Founder decisions and external inputs

Record these as decisions with owner/date/evidence; the working brief does not establish approval.

| Decision | Blocks |
|---|---|
| Approved brand/logo/colors/type/tagline and any signature treatment | Final design/content. Existing forest/orange styling is not proof of approved identity; proposed navy/teal is not mandatory. |
| Company name/legal wording, domain ownership, phone/WhatsApp/email/socials and service area | Publication of company/contact information. Repository defaults are not verified facts. |
| Launch services and reliable fulfilment partners, especially authorized ticketing | Which pages/requests can launch and which remain hidden. |
| Permission to name suppliers/use logos, imagery and testimonials | Trust/content publication. |
| Fee/currency/tax display, expiry/deadlines, payment methods and response promises | Quote templates, validation, finance and public copy. |
| Cancellation/change/refund, privacy/retention and support policy with qualified adviser | Terms, consent, secure fulfilment and after-booking support. |
| Daily lead owner, staff roles, follow-up/escalation and support hours | Access model and operational readiness. |
| Custom admin vs named CRM, channels/integrations and company account ownership | Implementation boundaries and ongoing operating costs. |
| Launch languages | English is the stated default; translations and translated policies require separate approval/review. |

Optional division names (Thrill Trips/Safaris/Stays/Concierge/Events/Business) and “Tembera Urwanda” do not create mandatory new modules. Confirm ownership, spelling and role before use.

## 14. Recommended implementation order and exit criteria

| Order | Work package | Depends on | Exit evidence |
|---|---|---|---|
| 1 — P0 | Approve launch scope and remove/gate conflicting claims/direct-booking entry points | Founder service/commercial/content decisions | Route/action inventory proves only approved service modes and wording are public. |
| 2 — P0 | Durable enquiry models, flight/service forms, consent, idempotency and source capture | Agreed data/retention contract | Guest enquiry tests: valid/invalid input, one reference, duplicate retry, save failure and no identity/card capture. |
| 3 — P0 | Staff lead board, manual capture, assignment/follow-ups, roles and audit trail | Enquiry core and approved staff responsibilities | Role-scoped sample enquiry handled without personal-message-only records. |
| 4 — P0 | Written quotes, acceptance, off-site payment reconciliation, supplier processing and finance | Approved quote/fee/payment/supplier policies | Sample checked quote → accepted version → reconciled payment → supplier confirmation; amounts reconcile. |
| 5 — P0 | Notifications/retries, staff history, basic support, weekly reports and exports | Event/state/financial data | Failure and recovery tests, overdue queue, metrics and export permission checks. |
| 6 — P0 | Security/accessibility/mobile/performance, staging acceptance and handover | Complete MVP and operational owners | Brief §14 staging results, backup restore, deployment rollback and founder content approval. |
| 7 — Phase 2 | PDF automation, richer supplier/customer history, approved channel automation and own-enquiry portal | Proven MVP usage and approvals | Improvement-specific acceptance tests; reuse existing customer/notification UI. |
| 8 — Phase 3 | Justified supplier integrations/corporate portal | Written supplier permissions, business case and founder approval | Independent integration/security/reconciliation acceptance. |

P0 means required before the quote-led MVP launch for its approved service scope. Conditional services do not block flights-first launch if deliberately withheld. Supplier register/history can begin with controlled internal records; the safeguards and reliable workflow remain required even when a dedicated module is deferred. This sequence is a dependency plan, not an effort estimate or approved schedule.

## 15. Required validation and handover still outstanding

After resolving the generated-client prerequisite in the approved environment workflow, rerun full tests/type checking and production build. Then validate in staging with controlled test data:

1. Flight and each enabled service form: field/date/count validation, phone-only contact, unchecked consent, duplicate retry, persistence/reference and unauthorized data access.
2. Save and notification failures independently: no lost leads, no false sent state, visible staff retry and correct per-recipient outcome.
3. Staff assignment and every allowed/disallowed transition, concurrent edits, follow-ups, notes, audit records and source/manual capture.
4. Quote versioning/expiry, acceptance, payment receipt deduplication, partial payments/refunds, supplier payable and per-currency reporting.
5. Supplier confirmation before customer booking confirmation; cancellation/support ownership and retained history.
6. Staff/customer/provider separation; suspended users; session/role revocation; private documents; password reset with missing email; export authorization and redacted logs.
7. Real mobile/desktop navigation, keyboard/focus/error announcements, contrast, image/font loads, data use and non-autoplay behavior.
8. Current metadata, share images, sitemap/robots, contact links and review of all public claims including stored settings.
9. Backup restoration, deployment/rollback, monitoring and operational incident/follow-up ownership.

Handover must include current design/page templates; schema and exports; deployment/configuration and environment-variable names; admin/staff guide; backup/restore steps; security/privacy notes; test results; known limitations; third-party service costs, account owners and renewals; and ownership/control of repository, hosting, domain, database and assets. Existing `.env.example` is a starting point, not evidence that production configuration is complete.

## 16. Complete brief-section traceability

| Brief section | Audit coverage / disposition |
|---|---|
| 1 Business and audiences | §§1, 4, 6: flights-first and guest requests; staff/returning/group audiences. |
| 2 Product/commercial safeguards | §§5, 7, 9, 13: claim controls, supplier checks and pass-through accounting. |
| 3 Services/sitemap/divisions | §§4, 13: service inventory and optional division names. |
| 4 Home/visual/assets | §§5, 6 FE01/FE07, 13: redesign, approved assets and claims. |
| 5 Forms/journeys/notifications | §§6 FE02/FE03, 7 BE01–03/BE12, 10: durable forms and safe outcomes. |
| 6 Staff workflow/record/roles | §§6 FE04, 7 BE04/BE10/BE11, 8. |
| 7 Quotes/invoices/payments | §§6 FE05, 7 BE05–08, 9: written quotes and off-site reconciliation. |
| 8 Suppliers | §§7 BE09/BE17, 11, 13: register/evidence/permissions; not just provider approval. |
| 9 History/support | §§6 FE06, 7 BE13/BE14, 15. |
| 10 Reports/source/integrations | §§7 BE07/BE15/BE16, 9, 11. |
| 11 Design/accessibility/SEO/performance | §§5 C07, 6 FE07, 12, 15: runtime QA still required. |
| 12 Security/privacy/resilience | §§7 BE02/BE03/BE10/BE11/BE18, 10, 15. |
| 13 Out of scope | §§5, 11, 14 and exclusions below. |
| 14 Acceptance | §12 checklist and §15 required tests. |
| 15 Founder decisions | §13. |
| 16 Delivery sequence | §14, with staging and soft-launch evidence. |
| 17 Enhancements | §§4, 6 FE05/FE06, 14: conditional MVP/Phase 2/Phase 3 work. |
| 18 Handover | §15. |
| 19 Commercial/project expectations | §15 ownership/cost register; milestone cost/timeline proposal remains a commercial deliverable, not implemented application behavior. |
| 20 Final principle | §1 and §14: prove enquiry, supplier fulfilment and contribution before expanding the marketplace. |

Excluded from the launch backlog unless separately approved: live airline fares/GDS booking, automatic ticket issue or fare holds, automated reissues/refunds, unapproved instant supplier inventory, card storage, wallet, automatic supplier payouts, native apps, loyalty points, AI trip planning and complex marketplace expansion. Existing gateway/provider code is not a reason to prioritize these ahead of the enquiry foundation.
