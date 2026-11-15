# Phase 5 — public alignment, support and reporting

This phase connects the public request journey with the enquiry, quotation, finance and fulfilment work delivered in Phases 1–4. It implements launch controls; it does not constitute business approval, a production release or full accessibility/legal certification.

## Public service controls

Administrators use `/admin/launch`. Every service defaults to **ENQUIRY** until an explicit record exists. The modes are:

| Mode | Public behavior |
|---|---|
| HIDDEN | Service pages/details and catalogue entries are unavailable; primary/footer navigation and home service cards omit it; new public submissions for that service are rejected. Staff can still record an existing/offline case. |
| ENQUIRY | Requests and written quotations lead the journey. New direct-booking submissions are blocked on the server; existing bookings and payable references remain intact. |
| DIRECT | An administrator has explicitly approved the inventory-backed booking path for trips, stays or transport. Flights, groups and events support enquiries only. Existing gateway configuration/payment switches remain separate prerequisites. |

Car hire and airport transfers share the TRANSPORT control, resolving their former availability contradiction. Service changes require approval evidence and the current version, record an audit event and invalidate public caches. Refresh an old form before retrying a conflicting change. Do not enable DIRECT simply because a provider or gateway key exists: service scope, supplier permissions, settlement and refund procedures need real approval.

The homepage keeps the existing administrator-controlled headline, subtitle, paragraph, brand and contact settings. Its new default presentation uses a static local image and explains request → checked quote → exact acceptance → approved payment/reconciliation → supplier confirmation. How It Works, Support, corporate and transfer pages describe that same sequence. Public claims of automatic ticketing, standard free waiting, universally insured vehicles, Kenyan regulatory compliance, fixed corporate rates/credit and guaranteed response/refund times have been removed from the rewritten flows. Admin-authored announcements, legal text, catalogue descriptions, links and approved offers still need editorial review; software cannot establish that their claims are true.

Prices on catalogue cards are presented as quotation requests. Approved DIRECT booking panels can still price existing inventory-backed services. Existing booking records, inventory calendars, gateway attempts, signatures and quote acceptance history are not converted or overwritten.

## Curated itineraries

Tour editors now record a description, day-by-day itinerary, suitability/accessibility/age/fitness requirements, inclusions, exclusions and media. These fields belong to the offer; the detail page no longer substitutes a global sample itinerary or universal inclusions.

Saving changes clears approval and unpublishes the offer. In Launch controls, the administrator reviews the full current offer and records supplier, rate, scope and media approval evidence. Approval verifies the exact content hash and active verified provider; stale content cannot be approved. Incomplete descriptions, media, itinerary, suitability or inclusions/exclusions block approval. Previously published tours need this explicit review before appearing publicly. Provider publication cannot bypass it. No sample offers are automatically approved.

Keep photography permissions, supplier conditions and prices on file. The brand share image is generated locally; final brand/metadata and media approval remains a release checklist item. Navigation destination imagery uses local assets or a neutral brand mark rather than loading external placeholders for every hidden menu. Existing hotel/vehicle media still requires review.

## Support ownership and escalation

Staff use `/staff/support`; administrators also have `/admin/support`.

- Link one accepted/mature enquiry in your workspace, or ask an administrator to open/assign a case for a legacy booking.
- Every case records a responsible active admin/sales/operations owner, category, priority, issue, next action in Kigali time and supporting evidence.
- Use Open, Waiting customer, Waiting supplier, Escalated or Resolved. Resolution requires an outcome and customer handover. Reopen a case through another audited update if necessary.
- Concurrent edits use a version check. Identical retries use their intent key without creating another activity; ownership/permission checks still apply on a retry.
- Staff see assigned support cases; administrators see all. Finance does not receive the travel/support narrative. Refund cases route work; only the financial workspace records refund obligations and actual payouts.

Launch controls also store approved staffed hours, public escalation instructions and urgent/out-of-hours guidance. `/support` shows those details and current configured phone/email/WhatsApp links. Until approved, the page asks customers to check staffed hours and does not promise continuous coverage. The desk is not an emergency service. Record a real escalation owner/process before launch; the case tracker does not send automatic notifications or establish an SLA. The support list displays up to 100 cases with reference search; each case shows the latest 20 activities.

## Reports, source attribution and exports

`/staff/reports` and `/admin/reports` default to the last seven inclusive Kigali dates. Choose up to 93 days, with at most 5,000 enquiry records per report; a larger result is rejected rather than silently truncated.

The **creation cohort** shows current statuses, quoted/accepted cases, source mix and elapsed median first response. Counts of unresponded cases accompany the median; nights and weekends count as elapsed time. Overdue follow-up/unresolved queues and support status counts are current snapshots across all dates. Supplier follow-through shows commitments, confirmed/pending counts, oldest unconfirmed date and next supplier review, without presenting these as a quality score. Manual supplier performance notes remain in the supplier register.

Financial cohort reports show balances **as of now for cases created in the selected period**. They do not describe cash movements during that period. Currency totals stay separate, unreviewed contribution stays unknown, and gateway totals are not merged. Use the Phase 4 guide for accounting definitions.

Operations CSV excludes contact, itinerary, private notes and support narratives. Financial CSV is limited to administrators/finance and includes the original currency and integer minor units. Search/report/export scopes follow fresh account permissions, even if the session cookie holds a former role. Every export is audited. Values are quoted, quotes escaped and spreadsheet formula prefixes neutralized, including whitespace/control prefixes; negative values may be emitted as apostrophe-prefixed text for spreadsheet safety. Review exported files' handling and retention outside the application.

Selected public CTA links increment fixed daily service/placement counters. The application stores no IP, URL/query string, visitor ID, cookie, contact or itinerary in these counters. Strict validation rejects extra properties. Each bucket is capped at 100,000 clicks per day. They are **best-effort interactions**, not unique visitors or verified conversions; repeat clicks, pre-hydration navigation, blocked beacons and automation affect counts. Operational source/quote/acceptance metrics come from saved enquiries rather than attempting to identify anonymous visitors. Hosting/access logs have their own retention controls and are not covered by the application's counter design.

## Private documents and account revocation

An administrator must approve document necessity, the customer notice and retention in Launch controls before new car-hire document collection is enabled. Retention is 1–90 days from upload. The checkout shows the approved purpose and maximum duration before upload. Backend confirmation checks enabled policy and non-expired required copies; an old browser form cannot treat an expired document as valid.

Every document download checks the current active user, booking scope, provider role/approval and retention deadline. Reads, uploads and deletion create audit events without copying document bytes, filenames, identity numbers or reset tokens into the audit. Stored expiry is an upper bound: extending the current policy cannot extend an existing document's deadline. Legacy copies without a stored expiry have a 30-day maximum, shortened by a shorter current policy. When collection is disabled, copies are unavailable for download. Expiry restricts access; it does not itself erase bytes.

Administrators review the oldest 100 retained copies in Launch controls and delete with authority/evidence. Deletion removes the stored copy and leaves a non-content audit record. **Run this review regularly**; [Phase 6 retention tooling](RELEASE_AND_HANDOVER.md#retention-and-legal-holds) supports an explicitly approved bounded purge and legal holds. No actual schedule is activated by committing it. Backups, signed hire agreements, financial/quote records and statutory retention/hold requirements need separate approved schedules in Phase 6. Confirm any legal hold before deletion and do not promise immediate removal from backups.

Sensitive booking/payment/agreement/review actions now use fresh active account data through the shared current-user helper. Image uploads check current role/provider approval, not just cached session claims. Password reset URLs are logged only in explicit development; production/test logs do not include recipient identities or reset tokens. Email provider activation remains separate.

## Validation and release checklist

Local commands: generate Prisma, keep `npm run db:local` running, apply committed migrations with `npm run db:deploy`, then run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` and `npx tsx scripts/check-launch-operations.ts`. The guarded integration runner uses only project-local PostgreSQL, restores pre-existing publication/policy records, deletes its own fixtures and sends no messages or money.

Before launch:

- [ ] Company approves the enabled service modes, accounts, offers, supplier conditions, media rights, brand/share image, metadata and public contacts.
- [ ] Approve final legal/privacy/cancellation copy and independently review any existing admin-authored content. Draft notices remain until that happens.
- [ ] Name support owners, staffed hours, escalation and urgent/out-of-hours coverage; walk staff through a real support scenario.
- [ ] Approve document necessity, retention, deletion review schedule, legal holds and backup handling before enabling collection.
- [ ] Repeat accessibility and mobile performance testing with real approved content, assistive technology and target devices. Automated checks do not establish full conformance.
- [ ] Validate mail sender/provider delivery, scheduling, backup/restore, monitoring and rollback under Phase 6. Pesapal activation requires separate approval.
- [ ] Staging acceptance and founder sign-off. Publishing remains a separate action.
