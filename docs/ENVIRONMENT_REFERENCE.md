# Environment variables and operational configuration

Use `.env.example` for local placeholders; never commit actual `.env` files. Use separate company-controlled secret stores for staging/production. Restart/rebuild under the intended environment when changing deployment configuration; keep auth/public origins consistent.

| Variable | Use | Secret / notes |
|---|---|---|
| APP_ENV | development, test, staging, production | Explicit deployment identity; Node production without it is Undeclared |
| NODE_ENV | Framework-controlled mode | Managed by Next/npm; do not repurpose |
| SOFT_LAUNCH_PRIVATE | Invited preview gate | Default false; true requires active staff/client/company access for public pages/new intake |
| NEXT_PUBLIC_SITE_URL | Public canonical/callback origin | Public; HTTPS for deployment; never localhost in deployment settings |
| BETTER_AUTH_URL | Authentication origin | Must match public origin; never localhost in deployment settings |
| BETTER_AUTH_SECRET | Sign/session protection | Secret, at least 32 characters, unique per environment |
| DATABASE_URL | Prisma runtime database | Secret; correct branch/database and verified transport |
| DIRECT_URL | Prisma migrations/backup connection | Secret; same database as runtime, direct connection where applicable |
| DATABASE_POOL_MAX | Standard pg pool size | Default 5; respect hosting/database limits |
| CRON_SECRET | Protected worker authorization | Secret, at least 32 characters; do not place in query strings |
| RELEASE | Image tag the server runs (`sha-<commit>`), reported by `/api/health` | Set by the image build; not secret. VPS only |
| SITE_DOMAIN / ACME_EMAIL | Caddy's HTTPS site and certificate-notice address | VPS only (`/opt/thrill/.env`) |
| IMAGE_REPO | Registry path of the release images | Optional; default `ghcr.io/alleluiacervi-tech/thrill-rwanda`. VPS only |
| BACKUP_HEARTBEAT_URL | Heartbeat pinged after each nightly backup (`/fail` on failure) | Optional; contains a check token, so treat it as a low-grade secret. VPS only |
| GOOGLE_SITE_VERIFICATION / BING_SITE_VERIFICATION | Content value of the Search Console / Bing HTML-tag verification, rendered as meta tags | Optional; public by design |
| SKYSCANNER_API_KEY / SKYSCANNER_MARKET / SKYSCANNER_CURRENCY | Skyscanner Indicative Prices key for the /flights fares board (market defaults to UK, currency to USD) | Key secret, from the Skyscanner partner programme. The source itself (Off, Duffel, Skyscanner) is chosen in Admin → Fares; Duffel needs a live token and `DUFFEL_ALLOW_LIVE=true` |
| RESEND_API_KEY / EMAIL_FROM | Email adapter and approved sender | API key secret; real domain/inbox validation required |
| URUBUTOPAY_ENABLED / URUBUTOPAY_ENVIRONMENT / URUBUTOPAY_LIVE_APPROVED | UrubutoPay collection gates | Default off; live requires production identity and saved Admin routing approval |
| URUBUTOPAY_API_KEY / URUBUTOPAY_MERCHANT_CODE / URUBUTOPAY_SERVICE_CODE | UrubutoPay merchant authentication | Server-side; separate merchant keys and services per environment |
| URUBUTOPAY_APPROVED_METHODS / URUBUTOPAY_MIN_RWF / URUBUTOPAY_MAX_RWF | Contracted channels and limits | Record the verified scope from BK TecHouse |
| URUBUTOPAY_WEBHOOK_USERNAME / URUBUTOPAY_WEBHOOK_PASSWORD / URUBUTOPAY_WEBHOOK_SECRET | Provider callback authentication | Give only the username and password to BK TecHouse. Keep the independent signing secret private |
| MTN_ENABLED / MTN_LIVE_APPROVED / MTN_BASE_URL / MTN_TARGET_ENVIRONMENT | Live MTN Rwanda Collections gates | Default off. Needs APP_ENV=production, an https non-sandbox base URL, the merchant pack target environment and a saved Admin routing policy that includes MOMO |
| MTN_SUBSCRIPTION_KEY / MTN_API_USER / MTN_API_KEY / MTN_MIN_RWF / MTN_MAX_RWF | MTN credentials and contracted RWF limits | Server-side only. The API user must be a UUID |
| PAYMENT_PUBLIC_ORIGIN | Public payment-link and return origin | Approved HTTPS origin for the deployment |
| PESAPAL_LEGACY_RECONCILE / PESAPAL_ENV / PESAPAL_LIVE_APPROVED / PESAPAL_CONSUMER_KEY / PESAPAL_CONSUMER_SECRET | Historical lookup during cutover | Default off. Preserve existing credentials during reconciliation only |
| CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET | Preferred listing-image storage driver | Secret API material; company-owned account |
| R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_PUBLIC_URL | Fallback image driver | Access credentials secret; bucket/public URL scope must be reviewed |
| BACKUP_ENCRYPTION_KEY | AES-256-GCM archive and manifest authentication | Dedicated 32-byte base64 secret, stored separately from archives |
| PG_DUMP_BIN / PG_RESTORE_BIN | PostgreSQL client executables | Optional full paths; match server major version |
| MAINTENANCE_DELETE_APPROVED | Enables approved scheduled private-copy deletion | Default false; enabled document policy and no hold also required |
| WHATSAPP_ENABLED | Optional approved status template channel | Default false; release evidence and explicit case opt-in also required |
| WHATSAPP_PHONE_ID / WHATSAPP_ACCESS_TOKEN | Company Meta Cloud API sender | Access token secret; phone ID validated as digits |
| WHATSAPP_STATUS_TEMPLATE / WHATSAPP_TEMPLATE_LANGUAGE | Provider-approved reference/status template | Body parameters: enquiry reference and current status only |
| SITE_URL / VERCEL_PROJECT_PRODUCTION_URL | Existing URL fallbacks | Prefer explicit NEXT_PUBLIC_SITE_URL/BETTER_AUTH_URL; ensure callbacks never cross environments |

Only listing images use the public media driver. Licence/ID copies remain private database records with purpose, expiry, scoped access and legal holds. No public URL or image CDN should receive them.

Business configuration lives in the database: Site settings (brand/contact), service publication, off-site settlement accounts, supplier agreements, operational support/document policy, release evidence, corporate/client grants and channel consent. Back up the schema and these records together. Recreating secrets is not the same as restoring the database.

No direct Daraja STK Push, live airline/GDS fare feed, automatic ticket issuance or automatic supplier payout is implemented. Legacy unused Daraja placeholders were removed from the example configuration to avoid implying that an unimplemented callback exists.
