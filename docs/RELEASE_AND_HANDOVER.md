# Operational release and handover

Phase 6 tooling and the later customer/company/supplier/channel features are implemented without activating a production service. The existing enquiry, quotation, off-site finance and inventory-booking domains stay separate.

## What operators use

| Workspace | Purpose |
|---|---|
| Admin → Launch checklist | Configuration items that need attention, scheduled jobs, and company approvals with owners and review dates |
| Admin → Launch controls | Public service modes, approved offers, support/document policy, retained-copy review and legal holds |
| Admin → Corporate clients | Explicit company membership and named case sharing |
| Staff enquiry detail | Identity-verified customer portal access, acceptance permission and explicit WhatsApp status-template consent |
| Staff → Suppliers | Case-linked performance reviews and corrective follow-up |
| Customer → My travel requests | Explicitly shared case history, immutable quotations/downloads, authorized exact-version acceptance and support requests |
| Customer → Company travel | Explicitly shared company cases; membership alone never authorizes quotation acceptance |

Required readiness records remain Pending until an authorized administrator records real evidence and a company owner. Marking records Verified is an audited human declaration, not an external verification or deployment. Optional WhatsApp may stay Not applicable. Required release evidence must be Verified and within its review date. The workspace never stores credentials.

## Dashboard workflows

| What you need to do | Workspace and access |
|---|---|
| Add a hotel, tour or vehicle | An administrator opens **Listings** and chooses an approved provider for that category. Approved providers can add and manage their own listings in the provider dashboard. |
| Publish a hotel | In **Listings**, open the hotel and publish at least one room type under **Room visibility**, then publish the property. **Launch controls** determine if stays are hidden, enquiry-only, or directly bookable. |
| Add a meeting hall | An administrator opens **Business venues**, saves the property, and enters the rooms and capacities. Publish both the property and each room that should appear in the public directory. |
| Record a flight or event request | Administrators, Sales and Operations use **Enquiries → Capture an enquiry**. Choose **Flight** or **A wedding or event → Thrill Events & Business**. Record the customer's permission, then assign or claim the case before quoting. |
| Review money and supplier confirmations | Finance and administrators issue invoice links and review digital collections in **Payments**. The finance ledger records verified statement credits. Operations records supplier and fulfilment updates within assigned cases. |
| Grant access | Super admins use **Users & access**. Administrators and staff enroll in two-step verification before using staff tools. |

The launch checklist records technical checks and human approvals. Daily staff work takes place in Enquiries, Listings, Bookings, Support or Finance. A missing email sender, storage connection or backup key needs action by the company owner responsible for that service. A pending approval needs a decision or evidence from the owner. Use the checklist to record these actions before public launch.

## Environment separation and accounts

Use independent hosting projects, databases/branches, auth secrets, worker secrets, storage credentials/buckets and provider accounts for development, staging and production. Set `APP_ENV` explicitly. A production Node build with no recognized APP_ENV is shown as Undeclared. Configuration checks report booleans and descriptions, not credential values. Runtime/migration URLs must identify the same database (Neon pooled/direct hostname variants are supported).

The company should own hosting, DNS, repository, database, mail, payment and storage accounts. Record named operational owner, access procedure, recurring cost/currency, renewal, evidence and next review in Admin → Readiness. Owner names, actual invoice totals and renewal dates are not invented in the repository. Restrict infrastructure access and enable provider-supported MFA. Removing app staff access does not remove infrastructure access; review both registers during offboarding.

See [ENVIRONMENT_REFERENCE.md](ENVIRONMENT_REFERENCE.md) for variables. Run `npm run ops:preflight`; use `-- --strict` for a deployment gate. Local development can intentionally show missing email, scheduler and backup configuration. A passing check confirms configuration shape, not provider delivery, correct business terms, account ownership or isolation from another deployment.

## Restricted soft launch

`SOFT_LAUNCH_PRIVATE=true` restricts public pages and new enquiry/booking actions to active staff or accounts with explicit active client/company access. Knowing a reference, registering an email or possessing an old session cookie is insufficient. Authentication screens and existing protected account/provider/staff/admin/checkout flows remain available under their own authorization. Invited users can review requests; existing customers retain their own legacy account/booking access.

Private preview disables indexing and emits an empty sitemap. Public page access is evaluated per request so cached public pages cannot bypass a changed preview policy. Metadata and marketing content still require company approval. This option is prepared but not activated here; setting it does not deploy or invite anyone.

## Backup and restore

Install PostgreSQL client tools matching the server major version. `PG_DUMP_BIN`/`PG_RESTORE_BIN` can specify full binary paths. Set a dedicated 32-byte base64 `BACKUP_ENCRYPTION_KEY` through a secret manager. Keep the key separately from archives, with an approved recovery owner and access process. Losing the key makes encrypted backups unrecoverable.

```
npm run ops:backup -- --out /private-backups/release-backup.trb
```

The tool exports a consistent repeatable-read PostgreSQL snapshot. It streams a custom-format dump directly into AES-256-GCM encryption, writes private files, and produces an HMAC-authenticated manifest with encrypted-file SHA-256 and table counts from that same snapshot. It never places a password in process arguments or prints credentials. Existing output files are not overwritten. `.backups/`, `.trb` and `.dump` are ignored by Git.

Transfer archive and manifest to approved encrypted off-machine storage. Define and record backup frequency, retention, recovery point/recovery time targets, restore-test cadence, deletion/hold handling and alert owner. This phase does not purchase storage or activate a recurring backup schedule. Copies include private documents, internal records and authentication/session data; access must be tightly restricted.

```
npm run ops:restore-check -- --file /private-backups/release-backup.trb --target 'postgresql://USER:PASSWORD@127.0.0.1:54329/thrill_restore_UNIQUE_LOWERCASE_IDENTIFIER'
```

Use actual environment credentials through an approved operator terminal; do not paste them into tickets or Git. The example target name must use at least eight lowercase letters/digits/underscores after `thrill_restore_`. The tool accepts only a newly created project-local target on port 54329, rejects connection-target overrides, authenticates archive/manifest, decrypts into a private temporary directory, restores with exit-on-error, compares every exported table count and checks foreign key validation. It drops only the fresh database it created and removes plaintext temporary files. It refuses an existing database rather than overwriting it. This is a **restore test**, not an in-place production restore command.

Production recovery must restore into a separate approved database, validate data and application behavior, revoke/rotate restored sessions as required, then change the deployment connection only under the incident/release procedure. Never blindly restore over a live database with this tool.

Local evidence: a PostgreSQL 17 encrypted archive restored into a disposable database with all 56 public table counts matching and no unvalidated foreign keys; the disposable database and test archive/key were removed. This does not establish production RPO/RTO or backup retention. Repeat a restore with the actual approved deployment data and recovery owners before release.

## Deploy, verify and roll back

1. Pin the reviewed Git commit and retain the previous deployable release. Check readiness records, company approvals, target environment and external account ownership. GitHub validation runs on a separate PostgreSQL 17 service without payment/mail/WhatsApp credentials.
2. Pass CI, `ops:preflight --strict`, staging acceptance and a restore test. Review migration SQL against the target. Create and verify the approved pre-migration backup.
3. Install from the lockfile, generate Prisma and run `npm run db:deploy` for committed migrations only. Never seed/reset production. Build and deploy through the company's approved hosting process.
4. Check `/api/health`, sign-in, fresh role revocation, public service modes, guest capture, quotation and exact acceptance, off-site finance, supplier confirmation, portal ownership and support. Use approved test records with no live money movement. Verify receipt in real approved provider inboxes separately.
5. Only after the named owner approves, enable the authorized service scope and schedules. Record release commit, evidence and rollback owner. Watch queues and support after release.

The migration added in this slice is additive. For code rollback, pause workers/channels, restore the prior application release against the still-compatible database and recheck critical flows. Do not run old notification workers over new WhatsApp jobs. Keep new tables/history rather than deleting migrations or financial evidence. Database rollback/recovery needs a separately validated restored database and explicit cutover; prefer a forward repair when suitable.

On the VPS, a push to `main` deploys automatically through `.github/workflows/deploy.yml` (see [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md)). Each deploy backs up, migrates, and then runs the old and new releases side by side for a few seconds. Its automatic rollback only returns to the previous application image: it never rolls back the database and never deletes data. That is why **every migration must be backward compatible (expand, then contract)**:
- add new columns as nullable or with a default;
- stop using a column in one release, and drop it in a later one;
- never rename a column in place.

## Monitoring and incident response

`GET /api/health` checks database connectivity and returns only `ok` or `unavailable`; it does not prove mail/gateway/supplier availability. Configure the company's uptime monitor, alert destination and on-call owner externally. Admin readiness shows blocked/failed jobs, expired-copy candidates and worker heartbeat timestamps. Heartbeat success means an invocation completed, not that every message reached an inbox. A timestamp older than a day is flagged for review; set external alerts appropriate to each actual schedule.

Protected endpoints use `Authorization: Bearer <CRON_SECRET>`:

- `/api/cron/enquiry-notifications`: bounded durable delivery batch; suggested external cadence should match workload and provider limits.
- `/api/cron/release-holds`: existing stale inventory hold cleanup.
- `/api/cron/maintenance`: bounded document-retention review; dry run unless approved deletion is enabled.

No scheduler is activated by committing these files. CLI notification processing also records its heartbeat. Check leases, retries and last-error codes in staff quotation delivery history. Uncertain delivery requires human review, not repeated sends. Confirm provider-side state before recovery; never paste customer content, tokens or provider response bodies into logs.

For an incident: contain the affected service/channel, preserve evidence, identify the named owner and impacted cases, review provider/database truth, choose a forward repair or controlled rollback, communicate through authorized company channels and document the outcome. The system does not automatically email/Slack an incident or claim an on-call rota exists.

## Retention and legal holds

`npm run ops:retention` is a dry run. Actual deletion requires both `--apply` and `MAINTENANCE_DELETE_APPROVED=true`, plus an enabled approved document policy. The cron endpoint follows the same approval flag. Batches contain at most 100 candidates, recheck the current policy/expiry under a document lock, skip legal holds and record non-content audit evidence with the reserved machine actor ID `00000000-0000-0000-0000-000000000000`.

Administrators place/release holds with legal authority/evidence in Launch controls. Expiry still blocks customer downloads while a hold preserves stored bytes. Manual deletion also refuses held copies. Approve actual necessity, hold process, deletion schedule and backup retention first. Signed agreements, immutable quote/finance records, operational audit and identity copies have different legal purposes; only the approved private-copy purge is automated here.

## Handover and remaining external gates

Walk administrators, sales, operations, finance, company representatives and customers through their real scoped workflows using the linked guides. Verify a lost session, revoked user, revised/expired quote, partial receipt, supplier failure, support escalation, refund and restore scenario. Record walkthrough owner and acceptance evidence in Readiness.

Still external: company account owners and actual subscriptions, approved content/policies/media/contacts, staff rota, real sender/template/inbox validation, scheduler/monitoring/backup activation, hosting/domain setup, staging/assistive-technology/target-device checks and founder release sign-off. Optional live supplier integrations require a named API, contract, credentials and data-sharing approval; none are invented or activated. Publishing remains separate.
