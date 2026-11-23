# VPS rollout plan: thrillrwanda.com on our own server

Living plan, started 2026-11-24. How the finished setup is run day to day stays in
[VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md); this file is how we get there.

**Legend:**
- `[x]` built in the repo (checked as far as possible without a server; see the progress log)
- `[s]` scripted in `deploy/server/bootstrap.sh`, waiting to run on the server
- `[ ]` still to do, or needs the server, the owner or DNS
- `[-]` deliberately deferred, with the reason

**Goal:** the site runs on one hardened VPS behind HTTPS at thrillrwanda.com, with its
own PostgreSQL. Every push to `main` that passes the checks is built once in GitHub
Actions, scanned, published, and rolled onto the server without downtime. Old images
are cleaned up, and the database, backups and certificates are never touched by
cleanup.

---

## 0. Audit: what exists and what is missing

### Already in the repo (branch `claude/phase-6-vps`, not on `main`)

| Piece | State |
|---|---|
| `Dockerfile` | Multi-stage, Node 24 slim. The `app` target is the Next.js standalone server, runs as the `node` user, and has a health check on `/api/health`. The `tools` target is used for migrations, backups and the scheduler. |
| `deploy/compose.yml` | `db` (Postgres 17, no published port, health check, named volume), `migrate` (runs once), `app`, `scheduler`, and `caddy` on ports 80 and 443. |
| `deploy/Caddyfile` | Automatic HTTPS, `www` redirects to the apex, `/api/cron/*` is closed to the internet, 25 MB body limit, zstd/gzip. |
| `scripts/vps-scheduler.ts` | Notifications and payment reconciliation every 5 minutes, encrypted backup at 02:30, document maintenance at 04:00, expired holds released at 05:00. |
| Backups | `scripts/backup-database.ts` writes an encrypted, signed archive. Retention is `BACKUP_KEEP_DAYS`. `ops:restore-check` exists. |
| `next.config.ts` | Security headers including HSTS with preload, no `X-Powered-By`, narrow image remote patterns. |
| `.github/workflows/validate.yml` | Typecheck, tests, lint, workflow checks against Postgres, and a build, on every push and PR. |
| Documents and passports | Stored in the database (`Bytes`), so the database backup covers them. |

### Gaps found

| # | Gap | Why it matters |
|---|---|---|
| G1 | The deploy files are on `claude/phase-6-vps`, which is 19 commits ahead of `main`. `main` has no `deploy/` and no `Dockerfile`. | Deploys run from `main`, so nothing can deploy until this branch is merged. |
| G2 | There is no deploy workflow. `deploy/update.sh` runs `git pull` and builds on the server. | Building on the server needs about 4 GB of memory, leaves build cache on its disk, needs GitHub access from the server, and runs code that no check has passed. |
| G3 | `docker compose up -d` recreates the single `app` container. | Every deploy has a gap of a few seconds to tens of seconds. |
| G4 | The `tools` image is the whole build stage: all `node_modules`, `.next` and the source, plus the Postgres client. | It is the largest image by far and is kept per release. It should hold only what migrations, the scheduler and backups need. |
| G5 | `deploy/.env.example` is missing variables the code reads: `DUFFEL_ACCESS_TOKEN`, `MAIL_USER`, `MAIL_PASSWORD` (admin mail), `R2_*`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_STATUS_TEMPLATE`, `WHATSAPP_TEMPLATE_LANGUAGE`, `DATABASE_POOL_MAX`. | The new server would start with ticketing and admin mail silently unconfigured. |
| G6 | Image uploads need Cloudinary or R2 in production; without them the driver is `none`. | Admin photo uploads fail unless one of them is set. |
| G7 | No Docker log rotation is configured. | The json-file logs grow until the disk is full. |
| G8 | Backups stay on the same server. | Losing the server loses the backups. |
| G9 | The Next image-optimiser cache (`.next/cache/images`, cached for a year) lives inside the container. | It is rebuilt on every deploy, and on a long-lived container it has no upper limit. |
| G10 | Images are not scanned, and base images use floating tags (`postgres:17-alpine`, `caddy:2-alpine`). | Unscanned images and unpredictable upgrades. |
| G11 | Nothing alerts on a full disk, a failed backup or the site being down. | Problems are found by customers. |
| G12 | The repository is private: the GitHub API returns 404 without sign-in. | The server needs credentials to pull images. We avoid keeping a long-lived token on the server (see Phase 5). |
| G13 | Vercel is still configured (`vercel.json` crons, `.vercel/`) and points at Neon. | After the move there must be one live copy of the site and one scheduler, not two. |

### The domain today (checked 2026-11-24)

- **Nameservers:** Spaceship (`launch1` and `launch2.spaceship.net`). DNS is edited in the Spaceship panel.
- **Address records:** none for `thrillrwanda.com` or `www`. The domain does not serve a website yet, so pointing it at the server breaks nothing.
- **Mail:** MX records point to `mx1` and `mx2.spacemail.com`, and SPF is `v=spf1 include:spf.spacemail.com ~all`. Admin mail depends on these. **Leave every MX and TXT record unchanged.**
- **CAA:** none.

---

## Inputs needed before Phase 1

| Input | From | Blocks |
|---|---|---|
| VPS: provider, public IPv4 (and IPv6), size, region, and root or initial SSH access | Owner or developer | P1 onwards |
| Access to the Spaceship DNS panel | Owner | P4 |
| Fresh database, or carry the Neon data over (VPS_DEPLOYMENT.md §4) | Owner | P2 |
| Off-server backup target: Cloudflare R2, Backblaze B2 or similar, with a bucket and write-only key | Owner | P7 |
| Cloudinary (or R2) credentials for uploads; Resend key and verified domain; Duffel token; admin-mail password | Owner | P2, P8 |
| Who gets alert emails, and an uptime-monitor account (Better Stack or UptimeRobot, free tier) | Owner | P7 |
| Merge `claude/phase-6-vps` into `main`. This also brings the flights, weddings and Tembera redesigns. | Developer | P5 |

**Recommended server:** Ubuntu 24.04 LTS, 2 vCPU, 4 GB memory, 60 GB+ SSD, in a European region
(Vercel used `cdg1`, Paris). Because builds move to CI, a 2 GB server with a 2 GB swap
file also works.

---

## Phases and dependencies

```
P1 Server hardening ──► P2 Database ──┐
        │                             ├──► P6 First deploy ──► P7 Monitoring ──► P8 Cutover & verification
        └──► P4 DNS & TLS ────────────┤
P3 Images (repo work) ──► P5 CI/CD ───┘
```

P3 and the repo parts of P5 can start today, before the server exists. P4 can start as soon
as the server has an IP address. DNS takes time to spread, so set it early.

---

## Phase 1: Server setup and hardening

- [ ] Create the VPS with Ubuntu 24.04 LTS, add our SSH public key at creation, and enable the provider's snapshots or backups if offered.
- [ ] `apt update && apt full-upgrade`, then set the hostname and timezone (keep UTC; the scheduler already converts to Kigali time).
- [s] Create the `deploy` user (no password, key-only).
- [s] Create the `ops` admin user with sudo, for people.
- [s] Harden SSH (`/etc/ssh/sshd_config.d/10-hardening.conf`):
  - `PermitRootLogin no`, `PasswordAuthentication no`, `KbdInteractiveAuthentication no`
  - `AllowUsers ops deploy`, `MaxAuthTries 3`, `LoginGraceTime 30`, `X11Forwarding no`
  - Optionally a non-standard port, to cut log noise.
- [s] Restrict the `deploy` key in `authorized_keys` to `restrict,command="/opt/thrill/bin/deploy-gate"`. It can then only start a deploy with a version tag (see Phase 5), never open a shell.
- [s] Firewall with UFW. Default deny incoming, allow outgoing. Allow SSH (rate-limited with `ufw limit`), 80/tcp, 443/tcp and 443/udp (HTTP/3).
- [s] Install `unattended-upgrades` for security updates only, with an automatic reboot window at 03:30 UTC. Containers restart on their own.
- [s] Install fail2ban with an sshd jail. This is defence in depth; key-only SSH is the main protection.
- [s] Install Docker Engine and the Compose plugin from Docker's apt repository, pinned to that repository.
- [s] Write `/etc/docker/daemon.json`:
  - `"log-driver": "local"` with `"log-opts": {"max-size": "10m", "max-file": "5"}` (G7);
  - `"live-restore": true`;
  - `"no-new-privileges": true`;
  - `"userland-proxy": false`.
- [s] Add a 2 GB swap file and set `vm.swappiness=10`.
- [s] Add kernel network hardening in `sysctl`: syncookies, no ICMP redirects, `rp_filter`.
- [s] Create `/opt/thrill/` owned by `deploy` and mode 750, holding `compose.yml`, `Caddyfile`, `.env` (mode 600), `backups/` and `bin/`.

**Note:** Docker inserts its own firewall rules for published ports and bypasses UFW for them.
Only Caddy publishes ports (80 and 443), and the database publishes none. Keep it that way:
never add `ports:` to `db` or `app`.

**Acceptance:**
- Root and password SSH logins are refused.
- `ops` can sudo.
- The `deploy` key cannot open a shell.
- `ufw status` shows only SSH, 80 and 443.
- An external `nmap` of the server shows only those ports.
- `docker info` shows the `local` log driver and live-restore.

---

## Phase 2: Database

- [x] Use PostgreSQL 17 in the `db` container. It is already defined, keeps its data in the named volume `db-data`, and publishes no port.
- [x] Pin the image to a minor version (`postgres:17.x-alpine`) and upgrade it deliberately.
- [s] Generate credentials on the server:
  - `POSTGRES_PASSWORD` with `openssl rand -hex 32` (letters and digits only, because it goes inside the URL);
  - `BETTER_AUTH_SECRET` and `CRON_SECRET` with `openssl rand -hex 32`;
  - `BACKUP_ENCRYPTION_KEY` with `openssl rand -base64 32`.
- [ ] Copy `BACKUP_ENCRYPTION_KEY` into the owner's password manager. Without it the backups cannot be read.
- [-] Use separate roles. *Deferred: it needs grants and default privileges kept in step with every migration, and it can only be tested against the real schema on a server. Do it after go-live as its own change.* `thrill` owns the schema and is used by migrations. Add an `app` role with only the data privileges (SELECT, INSERT, UPDATE, DELETE) for the website and scheduler. Migrations keep `DIRECT_URL` as the owner role.
- [x] Tune Postgres for 4 GB in a mounted `postgresql.conf` or `command:` flags:
  - `shared_buffers=512MB`, `effective_cache_size=2GB`, `max_connections=60` (done as `command:` flags, with `work_mem` and `maintenance_work_mem`);
  - `log_min_duration_statement=1000`, with `log_parameter_max_length=0` so customer values never reach the log.
- [x] Set `DATABASE_POOL_MAX` to match (10 per container, which still fits during a rollout with two `app` containers plus the scheduler, migrate and backup).
- [ ] Decide Neon: start fresh (the default), or run the `pg_dump`/`pg_restore` steps in VPS_DEPLOYMENT.md §4 before go-live.
- [x] Take a backup before every deploy, as the first step of the deploy gate, so a bad migration can be undone.
- [ ] Off-server copies are handled in Phase 7.

**Acceptance:**
- `migrate` exits 0.
- `/api/health` returns `{"status":"ok"}`.
- Port 5432 is unreachable from outside.
- A backup file appears in `backups/` and passes `ops:restore-check` on another machine.

---

## Phase 3: Images (repo work, can start now)

- [x] **Slim the `tools` image (G4).** Build it from a stage holding the production dependencies plus the dev tools it needs (`prisma`, `tsx`), with `prisma/`, `scripts/`, `src/lib/` and `tsconfig.json`, and without `.next` or the rest of the source. *Done: `prisma`, `tsx` and `dotenv` moved to `dependencies` (no version changes) so `npm ci --omit=dev` gives the tools; Next compiler binaries removed. Sizes are recorded in each deploy run summary. The first CI run gives the before and after numbers.*
- [x] **Keep the `app` image lean.** It already uses standalone output on a slim base. Also:
  - [x] the npm cache lives in a BuildKit cache mount, never in a layer;
  - [x] `node:24.22.3-bookworm-slim` is pinned by digest;
  - [ ] after the first CI build, check `.next/standalone` for unneeded traced files (`outputFileTracingExcludes`).
- [x] **Add OCI labels** (`org.opencontainers.image.source`, `.revision`, `.created`), so each image links back to its commit.
- [x] **Run as a non-root user and locked down.** `app`, `migrate` and `scheduler` run as `node`. In compose:
  - [x] `cap_drop: [ALL]`, `no-new-privileges`, an init process, memory and process limits, a `tmpfs` for `/tmp`, and a volume for `.next/cache`;
  - [x] Caddy keeps only `NET_BIND_SERVICE`;
  - [-] `read_only: true` is deferred. Next can write regenerated pages under `.next/server`, and that cannot be checked without running the image. Try it on the server and turn it on once the pages are confirmed to work.
- [x] **Bound the image cache (G9).** Mount the named volume `next-cache` at `/app/.next/cache` so optimised images survive deploys. The weekly cleanup removes files not read for 30 days.
- [x] **Pin third-party images** by minor version plus digest: `postgres:17.x-alpine` and `caddy:2.x-alpine`.
- [x] **Bring `deploy/.env.example` up to date (G5).** Add Duffel, admin mail, R2, the WhatsApp variables and `DATABASE_POOL_MAX`, each with a note.
- [x] **Change `deploy/compose.yml` to pull images instead of building them:**
  - `image: ghcr.io/alleluiacervi-tech/thrill-rwanda-app:${RELEASE}`, and the same for `-tools`;
  - keep `build:` in a `compose.build.yml` override for local builds.

**Acceptance:**
- `docker build` of both targets succeeds locally or in CI.
- Sizes are recorded here.
- A container started with `read_only` serves pages and optimised images.
- `docker compose config` is valid using only `RELEASE` and `.env`.

---

## Phase 4: Domain, DNS and TLS

Can start as soon as the server has an IP address, and runs alongside Phase 2.

- [ ] In Spaceship DNS, add the following records with TTL 300 for the switchover (raise to 3600 once stable):
  - `A @ → <server IPv4>`
  - `A www → <server IPv4>` (or `CNAME www → thrillrwanda.com`)
  - `AAAA @` and `AAAA www → <server IPv6>`, only if the server has IPv6 **and** port 443 answers on it; otherwise leave them out.
  - `CAA @ 0 issue "letsencrypt.org"` and `CAA @ 0 iodef "mailto:<owner address>"`. Caddy uses Let's Encrypt, with ZeroSSL as a fallback; add `0 issue "sectigo.com"` if that fallback should stay possible.
- [ ] **Do not touch** the MX, SPF, DKIM or other Spacemail TXT records.
- [x] Caddy already gets and renews certificates automatically and keeps them in the `caddy-data` volume, which cleanup must never remove.
- [x] Add a global Caddy `email` for expiry notices.
- [x] In the Caddyfile:
  - remove the `Server` header (`header -Server`);
  - keep the `/api/cron/*` block;
  - keep `www` → apex;
  - add `reverse_proxy` health and retry settings for Phase 5.
- [ ] HSTS: Next sends `max-age=63072000; includeSubDomains; preload`. **Do not submit the domain to the preload list until every subdomain (including any mail or webmail host) is HTTPS-only.** Preloading is hard to undo.
- [x] Client IPs: Caddy replaces any `X-Forwarded-For` sent by the visitor with the real address, which the activity log, checkout and rate limits rely on. If a CDN or proxy (for example Cloudflare) is ever put in front, add `trusted_proxies` at the same time.

**Acceptance:**
- `dig +short thrillrwanda.com` and `www` return the server's IP.
- `https://thrillrwanda.com` shows a valid certificate.
- `http://` and `www` both redirect to `https://thrillrwanda.com`.
- SSL Labs grade A or A+.
- `https://thrillrwanda.com/api/cron/release-holds` returns 404.
- Mail still arrives.

---

## Phase 5: CI/CD with GitHub Actions

**Shape:** `validate` (exists) → `build-and-publish` → `scan` → `deploy` (`production` environment) → `verify`.

### Workflow `.github/workflows/deploy.yml`

- [x] **Trigger:** `push` to `main` and `workflow_dispatch` with an optional `release` input, used for rollbacks. Use a `concurrency` group of `production` with `cancel-in-progress: false`, so deploys queue and never overlap.
- [x] **Gate on checks:** run the same validation steps as a reusable workflow (`workflow_call`) and make `build` depend on them. No image is published from a red commit.
- [x] **Build:**
  - `docker/setup-buildx-action`, with the GitHub Actions cache (`cache-from` / `cache-to: type=gha,mode=max`);
  - both targets, tagged `sha-<short sha>` and `main`;
  - `NEXT_PUBLIC_SITE_URL=https://thrillrwanda.com` as a build argument;
  - SBOM and provenance attestations on;
  - push to GHCR with `GITHUB_TOKEN` (`packages: write`).
- [x] **Scan:** Trivy on both images. Fail on CRITICAL vulnerabilities that have a fix, report HIGH, and upload SARIF to the Security tab (`security-events: write`).
- [x] **Deploy:**
  - an `environment: production` job, which can require a reviewer later;
  - secrets `VPS_HOST`, `VPS_PORT`, `VPS_SSH_KEY` (ed25519, used only for deploys) and `VPS_KNOWN_HOSTS` (the server's host key, pinned; no `ssh-keyscan` at deploy time);
  - the job runs `ssh deploy@host <release>`, and the forced command `deploy-gate` does the rest. The application's secrets never enter GitHub; they live only in `/opt/thrill/.env` on the server.
- [x] **Registry access without a stored token (G12):** the deploy job passes the job's short-lived `GITHUB_TOKEN` (read-only for packages) to the gate on standard input. The gate runs `docker login ghcr.io --password-stdin`, pulls, then `docker logout`. Nothing lasting is left on the server. The fallback is a fine-grained, read-only `read:packages` token in root-owned `/opt/thrill/.ghcr`.
- [x] **Permissions:** workflow-level `permissions: contents: read`, widened per job. Pin third-party actions to commit SHAs. Turn on Dependabot for `github-actions` and `npm`.

### Deploy gate `deploy/bin/deploy-gate` (server side, versioned in the repo)

1. Accept only `^sha-[0-9a-f]{7,40}$` as input, or `rollback`. Reject anything else.
2. Take a lock (`flock`), so only one deploy runs at a time.
3. Pull both images for the release. If the pull fails, stop with the running site untouched.
4. Copy `compose.yml`, `Caddyfile` and the gate itself out of the tools image (`docker create` + `docker cp`). The deploy configuration then always matches the code it ships, and the server needs no git checkout.
5. Run a backup before migrating.
6. Run `migrate` with the new tools image. If it fails, stop; the old app keeps running.
7. **Swap without downtime (G3):**
   - start a second `app` container on the new image (`docker compose up -d --no-deps --scale app=2 --no-recreate app`) and wait until Docker reports it healthy, with a timeout of 120 s;
   - Caddy load-balances `app:3000` across both, with `lb_try_duration`, passive health checks and `health_uri /api/health`;
   - stop and remove the old container;
   - if the new one never becomes healthy, remove it and leave the old one serving. This is the pattern of `docker-rollout`; we can use that plugin or the ~40-line equivalent.
8. Restart `scheduler` on the new tools image, and restart Caddy only if the Caddyfile changed (`caddy reload`, with no connection drop).
9. Record `RELEASE=<tag>` and the previous tag in `/opt/thrill/releases.log`, so `rollback` knows where to go.
10. Clean up (see Phase 7). Keep the current and the 3 previous release images for each repository.

### Verify

- [x] From the runner, retry for up to 2 minutes until:
  - `https://thrillrwanda.com/api/health` returns `ok`;
  - the home page returns 200;
  - the gate's output reports the expected release.
- [x] If verification fails, run `rollback` automatically and mark the run failed.
- [x] Add an `X-Release` response header or an `/api/health` field with the image revision, so verification can confirm the new release is the one serving.

### Rules for migrations

- [x] Because the old and new app overlap for a few seconds, migrations must be **backward compatible** (expand then contract). Add a column in one release and remove the old one in a later release, never in the same one. Written into VPS_DEPLOYMENT.md ("How a deploy works") and RELEASE_AND_HANDOVER.md.
- [x] A rollback returns to the old image but **does not undo migrations**. That is why the pre-deploy backup exists.

**Acceptance:**
- A push to `main` reaches production with no manual step.
- A failing test stops the run before any image is published.
- A Trivy critical stops the deploy.
- During a deploy, a loop requesting `/api/health` every 0.5 s sees no non-200 response.
- A deliberately broken release (failing health check) is rejected while the old one keeps serving.
- `workflow_dispatch` with an earlier tag rolls back.
- The GHCR package stays private.

---

## Phase 6: First deploy

- [ ] Merge `claude/phase-6-vps` → `main`, after review, with CI green (G1).
- [ ] Merge the Phase 3 and Phase 5 repo work.
- [ ] On the server:
  - fill in `/opt/thrill/.env` from `deploy/.env.example`;
  - install `deploy-gate` once by hand (later deploys update it themselves);
  - add the GitHub secrets.
- [ ] Run the workflow with `workflow_dispatch`.
- [ ] Check that all containers are up, `app` is healthy and `migrate` exited 0.
- [ ] Create the first super admin (VPS_DEPLOYMENT.md §3). Do not run the demo seeds.
- [ ] Set the production values for Resend (verify the domain's DKIM in the Resend panel by adding records alongside Spacemail's, not replacing them), Cloudinary or R2, Duffel and admin mail.

**Acceptance:** the site works end to end on the server's address before the public DNS is relied on:
- sign in, with two-factor;
- an admin upload;
- a test enquiry email (to our own address);
- a scheduled job shows in Admin → Launch → readiness.

---

## Phase 7: Security, monitoring and maintenance

### Cleanup (disk), safe by construction

- [x] Weekly systemd timer `thrill-cleanup` (also runs at the end of each deploy):
  - remove `ghcr.io/.../thrill-rwanda-*` images except the running release and the 3 before it;
  - `docker image prune -f`, which removes dangling images only;
  - `docker container prune -f --filter until=24h`;
  - `docker builder prune -f --keep-storage 1GB`;
  - remove files under the `next-cache` volume not accessed for 30 days.
- [x] **Never** run `docker system prune --volumes` or `docker volume prune`, and never `down -v`. The volumes `db-data`, `caddy-data`, `caddy-config` and `next-cache`, and the folder `backups/`, are permanent.
- [x] Delete GHCR package versions beyond the newest 15 with `actions/delete-package-versions` in a monthly workflow.

### Backups

- [x] Nightly encrypted backup (exists), then **copy it off the server** (G8):
  - use `rclone` with a key that can only write to its bucket, to R2 or B2;
  - set a lifecycle rule on the bucket: 30 daily and 12 monthly copies;
  - turn on object lock or versioning if available, so a compromised server cannot delete history.
- [ ] Do a monthly restore test on another machine (`ops:restore-check`) and write down the date here.

### Monitoring and alerts

- [ ] External uptime monitor on `https://thrillrwanda.com/api/health` every minute, plus a TLS-expiry check, alerting the owner and the developer.
- [x] Heartbeat check (healthchecks.io free tier, or Better Stack heartbeats): the scheduler pings after each successful backup and each off-site copy, so a missed backup raises an alert.
- [x] Disk and memory alert: a 15-minute timer alerts by Resend email or a heartbeat failure when the root filesystem passes 80% or memory stays above 90%.
- [x] Logs: the Docker `local` driver with rotation (Phase 1). Read them with `docker compose logs -f app caddy scheduler`. Caddy access logs carry no request bodies.
- [ ] Optional: `node-exporter`, or the provider's built-in graphs, for CPU, disk and network history.

### Security, ongoing

- [x] Weekly scheduled Trivy rescan of the running release, so new vulnerabilities are found in images already deployed.
- [x] Dependabot for npm and actions (Phase 5), and review its PRs weekly.
- [ ] Rotate the deploy SSH key, and `CRON_SECRET`, `BETTER_AUTH_SECRET` and `POSTGRES_PASSWORD`, once a year or when a person leaves, using the steps in VPS_DEPLOYMENT.md.
- [ ] Before launch: plan a Content-Security-Policy with nonces. `next.config.ts` explains why it was left out; it is a known gap, not an oversight.

**Acceptance:**
- Stopping `app` by hand triggers an uptime alert within 2 minutes.
- Skipping a backup triggers a heartbeat alert.
- A filled test file pushes the disk alert.
- After 10 deploys, disk use is flat, with at most 4 releases of images present.
- A backup file is in the off-site bucket every morning.

---

## Phase 8: Cutover and final verification

- [ ] Lower the DNS TTL a day early if there were older records (there are none today, see the audit).
- [ ] Make the DNS change (Phase 4) and watch for the certificate in `docker compose logs caddy`.
- [ ] After moving (VPS_DEPLOYMENT.md §8):
  - update the UrubutoPay callback origin and the Resend domain;
  - stop Vercel's crons and remove its production domain;
  - remove the Neon database after any data is carried over (G13).
- [ ] Final checklist:
  - [ ] `dig` shows the right IP. SSL Labs grade A or better. HTTP redirects to HTTPS, and `www` to the apex.
  - [ ] `/api/health` is `ok`. Database connectivity is confirmed through it.
  - [ ] Push a trivial change to `main`. It deploys with zero failed requests, and the release header shows the new version.
  - [ ] A rollback to the previous tag works.
  - [ ] The nightly backup is created, copied off the server and restored on another machine.
  - [ ] Alerts fire for app down, a missed backup and a full disk.
  - [ ] An external port scan shows only 22 (or the custom SSH port), 80 and 443.
  - [ ] Mail (MX) still works. Enquiry emails arrive.
  - [x] VPS_DEPLOYMENT.md is updated to describe the CI-driven flow, replacing `update.sh`.

---

## Risks

| Risk | Effect | Mitigation |
|---|---|---|
| A migration that is not backward compatible | The old app errors during the few-second overlap, or a rollback cannot read the schema | Expand/contract rule, the pre-deploy backup, and migrations reviewed in PRs |
| Docker group membership is root-equivalent | Anyone holding the deploy key controls the server | The forced-command gate accepts only a release tag, the key is used only for deploys, and the host key is pinned |
| Cleanup deletes data | Lost database or certificates | Cleanup touches only images, containers and build cache, and never volumes. This is tested in Phase 7. |
| DNS edits break mail | Admin mail stops | Only add A, AAAA and CAA records; MX and TXT stay untouched; check mail in the Phase 4 acceptance |
| Let's Encrypt rate limits after repeated failed attempts | No certificate for hours | Point DNS before starting Caddy, keep the `caddy-data` volume, and use the staging CA for experiments |
| HSTS `includeSubDomains; preload` | Any HTTP-only subdomain becomes unreachable | Don't submit for preload until every subdomain is HTTPS-only |
| One server is a single point of failure | Outage if the host fails | Provider snapshots, off-site backups, a restore that has been tested, and a written rebuild path (this plan) |
| Disk fills (logs, images, image cache) | Postgres stops writing | Log rotation, image retention, cache expiry, and the 80% alert |
| Two live copies (Vercel and VPS) | Duplicate emails or crons, and split data | Phase 8 switches Vercel off |
| A GHCR outage during a deploy | The deploy fails | The pull happens before anything stops, so the running site is untouched |

---

## Progress log

- 2026-11-24 — Audit done (section 0). Waiting on the inputs listed above. Phase 3 and the repo side of Phase 5 can start now.
- 2026-11-24 — **Repo side of Phases 1, 3, 5 and 7 built** (not yet committed):

  | Area | Built |
  |---|---|
  | Images | `Dockerfile` rewritten: a slim `tools` image, Node pinned by digest, `RELEASE` baked in. `package.json` moves `prisma`, `tsx` and `dotenv` to dependencies (lockfile versions unchanged). `.dockerignore` excludes the generated client and every `.env`. |
  | Compose | `deploy/compose.yml` pulls GHCR images by `RELEASE`, pins Postgres and Caddy by digest, hardens every service, sets limits, tunes Postgres and adds the `next-cache` volume. `compose.build.yml` keeps local builds. |
  | Caddy | `deploy/caddy/Caddyfile` balances over every running `app` container (dynamic A records, retries), sets an ACME email and removes the `Server` header. |
  | Server scripts | `deploy/bin/`: `deploy-gate` (forced-command deploy/rollback/status), `thrill` (compose wrapper that refuses `-v`), `thrill-cleanup`, `thrill-watch` and `thrill-offsite`. `deploy/server/bootstrap.sh` does all of Phase 1; `deploy/server/systemd/` holds three timers. `deploy/update.sh` is removed. |
  | Workflows | `deploy.yml` (validate → build → Trivy → roll out → confirm → automatic rollback), `validate.yml` (now reusable; main is validated by the deploy), `packages-cleanup.yml`, `security-rescan.yml` and `dependabot.yml`. Every action is pinned to a commit SHA. |
  | App | `/api/health` reports `release`. The scheduler calls `tsx` directly and pings `BACKUP_HEARTBEAT_URL`. |
  | Docs | `VPS_DEPLOYMENT.md` rewritten for the CI flow. The migration rule is in `RELEASE_AND_HANDOVER.md`. New variables are in `ENVIRONMENT_REFERENCE.md`. `.gitattributes` forces LF for `deploy/`, `Dockerfile` and `.github/`. |

  **Checked:**
  - typecheck and lint;
  - scheduler tests;
  - `bash -n` on every script;
  - all YAML parses;
  - `deploy-gate` refuses 12 malformed or hostile requests (`;id`, `$(id)`, extra arguments, uppercase tags, `../`) before taking the lock. This test found and fixed a silent exit when `.env` is missing.

  **Not yet checked:**
  - Docker is not installed on the development machine, so neither image has been built yet; the first CI run builds both.
  - shellcheck and actionlint were not run (running downloaded binaries needs the user's approval).
  - Nothing has run on a server.

  **Next:** the inputs above (server, DNS, keys), then Phase 6.
