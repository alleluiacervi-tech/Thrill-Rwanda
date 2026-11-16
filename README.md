# Thrill Rwanda — V2 travel operations

A Next.js application for flights-first enquiries and checked Rwanda travel arrangements. The existing inventory booking engine is retained alongside explicit service modes; quotations, off-site finance and supplier fulfilment do not automatically create bookings or gateway payments.

Implemented software includes guest/service enquiries, scoped staff triage, immutable quotations and exact acceptance, durable delivery, receipt reconciliation and split allocations, supplier payables/fulfilment, refunds, public launch controls, support, scoped reports/CSV, document retention/holds, customer/company portals, supplier reviews, revision assistance and an approval-gated WhatsApp status adapter.

Operational release, accounts, approved business content, real provider delivery and founder sign-off remain evidence gates. Nothing in the source code establishes company ownership, regulatory approval or production readiness by itself.

## Run locally

Use Node.js 24 and npm. Copy `.env.example` to a local `.env`, set a development authentication secret, then:

```sh
npm ci
npm run db:local
```

Keep PostgreSQL running and open another terminal:

```sh
npm run db:generate
npm run db:deploy
npm run dev
```

Open `http://localhost:3000`. Local PostgreSQL listens on port 54329 and persists in ignored `.local-postgres/`. Do not delete/reset a database to apply additive migrations. Sample seeding is optional development content and never production data or supplier approval.

## Workspaces

| Area | Route |
|---|---|
| Public flight request | `/flights` |
| Other service requests | `/enquire` |
| Staff enquiries/support/reports/suppliers | `/staff` links |
| Admin launch/release evidence | `/admin/launch`, `/admin/readiness` |
| Corporate access management | `/admin/clients` |
| Customer request/quote history | `/account/enquiries` |
| Company case sharing | `/account/corporate` |
| Existing inventory booking history | `/account/bookings` |

New services default to enquiries. Only verified, explicitly granted cases appear in customer/company portals. Access, acceptance authority, financial records and supplier/publication approvals remain separate controls.

## Validate

```sh
npm test
npm run lint
npm run typecheck
npx tsx scripts/check-flight-enquiries.ts
npx tsx scripts/check-enquiry-workflow.ts
npx tsx scripts/check-quotations.ts
npx tsx scripts/check-finance.ts
npx tsx scripts/check-launch-operations.ts
npx tsx scripts/check-client-release.ts
npm run build
```

Database integration scripts refuse non-project-local/production targets. Run them sequentially because they share fixture counts and policies. They remove their generated fixtures; message transports are mocked in tests. The GitHub validation workflow uses an isolated PostgreSQL 17 service, not deployment credentials. Rebuild/refresh local caches after disposable browser fixtures so preview content cannot linger.

## Operational commands

| Command | Purpose |
|---|---|
| `npm run ops:preflight` | Configuration shape checks without revealing values; add `-- --strict` for a gate |
| `npm run ops:backup -- --out PRIVATE_PATH.trb` | Consistent, encrypted PostgreSQL custom archive and authenticated manifest |
| `npm run ops:restore-check -- --file PRIVATE_PATH.trb --target LOCAL_RESTORE_URL` | Restore into a fresh guarded local database, verify and remove it |
| `npm run ops:retention` | Dry-run bounded expiry review; actual purge needs documented approval and `--apply` |
| `npm run notifications:work -- --dry-run` | Inspect pending jobs without sending or changing records |
| `npm run db:deploy` | Apply committed migrations to the intentionally selected database |

PostgreSQL client tools and a dedicated backup encryption key are required for backup/restore. Never put credentials in tickets/Git, enable live payments casually, or run production seed/reset commands. Encrypted archives and restore artifacts are ignored by Git. Schedulers, monitoring and publishing are not activated automatically.

## Guides and plan

- [Phased delivery and validation evidence](docs/V2_DELIVERY_PLAN.md)
- [Historical V2 audit](docs/V2_IMPLEMENTATION_AUDIT.md)
- [Enquiry operations](docs/ENQUIRY_OPERATIONS.md)
- [Quotations and delivery](docs/QUOTATIONS_AND_DELIVERY.md)
- [Off-site finance and suppliers](docs/FINANCE_AND_SUPPLIERS.md)
- [Public launch, support and reporting](docs/PUBLIC_LAUNCH_SUPPORT_AND_REPORTING.md)
- [Customer/company portals and channels](docs/CLIENT_PORTALS_AND_CHANNELS.md)
- [Release, restore, rollback and handover](docs/RELEASE_AND_HANDOVER.md)
- [Environment reference](docs/ENVIRONMENT_REFERENCE.md)
- [Product experience plan: the five front doors, phase by phase](docs/PRODUCT_EXPERIENCE_PLAN.md)
- [Photograph sources](docs/PHOTO_SOURCES.md)
- [Architecture](docs/ARCHITECTURE.md)

Stack: Next.js 16.3 / React 19 / TypeScript / Tailwind 4 / Prisma 7 / PostgreSQL / Better Auth. Resend, Pesapal, Cloudinary/R2 and Meta are supported adapters whose company approval and deployment configuration are separate from implementation. There is no live GDS, automatic ticket issuance, wallet, automatic supplier payout, native app or AI planner.
