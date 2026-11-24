# Running Thrill Rwanda on a VPS

One Ubuntu server runs the whole site with Docker. GitHub Actions builds every
release and rolls it out. Nobody builds or pulls code on the server by hand.
How we got here, and what is still to do: [VPS_ROLLOUT_PLAN.md](VPS_ROLLOUT_PLAN.md).

| Container | What it does |
|---|---|
| `db` | PostgreSQL 17. Not reachable from the internet; data in the `thrill_db-data` volume. |
| `migrate` | Applies database migrations for a new release, then exits. |
| `app` | The website. During a deploy two run side by side for a few seconds. |
| `scheduler` | Sends queued notifications and reconciles payments every 5 minutes, makes the encrypted backup at 02:30, runs document maintenance at 04:00 and releases expired holds at 05:00 (Kigali time). |
| `proxy` | Spreads requests over the running `app` containers, on `127.0.0.1:4100` only. HTTPS is done by the server's own Caddy, which also serves the other sites on this server (`/etc/caddy/sites/thrillrwanda.caddy`). |

On the server everything lives in `/opt/thrill`:

```
/opt/thrill/
  .env            the site's settings and secrets (mode 600, never leaves the server)
  ops.env         heartbeat URLs and the off-site backup target (host scripts only)
  compose.yml     written by each deploy from the release's own image
  caddy/Caddyfile the proxy's settings, written by each deploy
  bin/            deploy-gate, thrill, thrill-cleanup, thrill-watch, thrill-offsite
  backups/        nightly encrypted backups (also copied off the server)
  .release        the release that is live, e.g. sha-1a2b3c4d5e6f
  releases.log    every release that went live, oldest first
```

## How a deploy works

A push to `main` runs [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):

1. **Validate.** Typecheck, tests, lint, workflow checks and a build ([`validate.yml`](../.github/workflows/validate.yml)). If anything fails, nothing is published.
2. **Build.** Both images are built once and pushed to GHCR (private) as `thrill-rwanda-app:sha-<commit>` and `thrill-rwanda-tools:sha-<commit>`.
3. **Scan.** Trivy blocks the deploy if there is a critical vulnerability that has a fix. The run summary lists the counts, and the reports and SBOMs are kept for 90 days.
4. **Roll out.** Actions connects as `deploy` over SSH. That key can only run [`deploy-gate`](../deploy/bin/deploy-gate), which:
   1. pulls the images, using the job's own short-lived token, which is not stored on the server;
   2. takes the configuration from the image;
   3. **backs up the database, then migrates**;
   4. starts the new `app` beside the old one, and stops the old one only once the new one is healthy and reports the new release.

   A failure at any step leaves the previous release serving.
5. **Confirm.** Actions checks `https://thrillrwanda.com/api/health` from outside. If it does not report the new release within 2 minutes, it rolls back.

**Migrations must be backward compatible** (expand, then contract), because the old and new
versions run together for a few seconds and a rollback keeps the newer schema. Add a column
in one release and drop the old one in a later release, never both in the same one.

### Rolling back

- **Automatic:** when the confirmation step fails.
- **By hand from GitHub:** Actions → *Deploy to the VPS* → *Run workflow*, with an earlier tag (from `releases.log` or GHCR). This skips the build and runs no migrations.
- **On the server:** `ssh thrill@SERVER rollback` (only with the deploy key) returns to the most recent other release. The last 4 releases' images are kept on the server for this.

## 1. Set up the server (once)

> **The current server (152.239.122.192, Hostinger) is shared.** It already serves ora.luxury, sawacars.com and api.ubirwanda.cloud. On it, Thrill was set up with [`setup-shared-host.sh`](../deploy/server/setup-shared-host.sh), which only adds Thrill's own pieces: the `thrill` user, `/opt/thrill`, the `thrill-*` timers, the `thrill` compose project and, after DNS, one Caddy site file. Server-wide settings and the other projects were left as they were, and were checked unchanged afterwards. **Never run `bootstrap.sh` on it.** The steps below are for a future dedicated, empty server.
>
> On the shared server, after DNS points here: `INSTALL_SITE=1 bash /root/thrill-deploy/server/setup-shared-host.sh`. It adds the Caddy site, checks the whole Caddy configuration, and only then reloads it gracefully.

Ubuntu 24.04, 2 vCPU, 4 GB memory, 60 GB disk. No builds happen on the server, so 2 GB with swap also works.

1. Make two SSH keys on your machine. One is yours. The other is the deploy key, used only by GitHub:
   ```sh
   ssh-keygen -t ed25519 -f ~/.ssh/thrill_deploy -C github-actions-deploy -N ""
   ```
2. Copy the `deploy/` folder to the new server and run the bootstrap as root. **Keep that session open** until you have logged in as `ops` from another terminal:
   ```sh
   scp -r deploy root@SERVER:/root/thrill-deploy
   ssh root@SERVER
   OPS_SSH_KEY="$(cat your-key.pub)" DEPLOY_SSH_KEY="ssh-ed25519 AAAA... github-actions-deploy" \
     ACME_EMAIL=owner@thrillrwanda.com bash /root/thrill-deploy/server/bootstrap.sh
   ```
   [`bootstrap.sh`](../deploy/server/bootstrap.sh) sets up the server:
   - **Users:** `ops` for people (with sudo) and `deploy` for GitHub (forced command, no shell). Root and password logins are turned off.
   - **Firewall:** UFW allows only SSH (rate limited), 80 and 443.
   - **Updates:** automatic security updates, plus fail2ban.
   - **Docker:** installed from Docker's own repository, with log rotation and swap.
   - **Settings:** `/opt/thrill/.env` is created with fresh database, auth, cron and backup secrets.
   - **Output:** it prints the values GitHub needs, and the backup key.
3. **Store the printed `BACKUP_ENCRYPTION_KEY` in the owner's password manager.** Without it no backup can be opened.
4. Fill in the rest of `/opt/thrill/.env`: Resend, Cloudinary, Duffel, the admin-mail password and payments.
   ```sh
   sudo -u thrill nano /opt/thrill/.env
   ```
5. In GitHub, under *Settings → Secrets and variables → Actions*:
   - **Secrets:**
     - `VPS_HOST`
     - `VPS_KNOWN_HOSTS` (the line the bootstrap printed, which pins the server's identity)
     - `VPS_SSH_KEY` (the contents of `~/.ssh/thrill_deploy`, the private half)
   - **Variables:**
     - `DEPLOY_ENABLED=true` (until it is set, pushes to `main` build and scan but do not deploy)
     - `SITE_URL=https://thrillrwanda.com`
     - `VERIFY_PUBLIC=false` until DNS points at the server; delete it afterwards
     - `VPS_PORT` only if SSH is not on 22
6. DNS at Spaceship: `A @` and `A www` → the server's IPv4. Also add `CAA @ 0 issue "letsencrypt.org"`. **Do not change the MX or TXT records**; they carry the company mail.
7. Run the first deploy: Actions → *Deploy to the VPS* → *Run workflow* (or push to `main`).

## 2. The first super admin

Sign up on the website with the owner's email address, then on the server:

```sh
sudo /opt/thrill/bin/thrill run --rm --no-deps migrate tsx scripts/make-super-admin.ts owner@example.com
```

At their next sign-in they set up two-step sign-in (an authenticator app), and
from then on grant everyone else's access in Admin → Users & access. The
activity log records the change as made from the server console.

Do not run the demo seeds on this server.

## 3. Moving the data from Neon (optional)

Neon was a test database, so a clean start is usually right. To carry its data
over instead, before people start using the new site:

```sh
# On any machine with PostgreSQL 17 client tools; use Neon's direct (non-pooler) address.
pg_dump --format=custom --no-owner --no-acl "<neon direct url>" > neon.dump
# Copy neon.dump to the server, then:
T=/opt/thrill/bin/thrill
sudo $T stop app scheduler
sudo $T cp neon.dump db:/tmp/neon.dump
sudo $T exec db pg_restore --clean --if-exists --no-owner -U thrill -d thrill_rwanda /tmp/neon.dump
sudo $T exec db rm /tmp/neon.dump
sudo $T start app scheduler
```

## 4. Everyday commands

`bin/thrill` is `docker compose` for the live release. It refuses `-v`, which would delete the database.

```sh
sudo /opt/thrill/bin/thrill ps                         # all up, app "healthy"
sudo /opt/thrill/bin/thrill logs -f --tail 100 app proxy
sudo /opt/thrill/bin/thrill logs -f scheduler          # one line per job: "backup ok", "enquiry-notifications HTTP 200"
sudo -u thrill /opt/thrill/bin/deploy-gate status      # live release and containers
cat /opt/thrill/releases.log
systemctl list-timers 'thrill-*'                       # watch, off-site copy, cleanup
```

Never run `docker system prune --volumes`, `docker volume prune` or `compose down -v`
here: the volumes hold the database and the certificates.

## 5. Backups

- **Nightly (02:30 Kigali):** the scheduler writes an encrypted archive and a signed manifest to `/opt/thrill/backups` and keeps them for `BACKUP_KEEP_DAYS` (14). Every deploy that migrates also takes a backup first.
- **Off the server (01:30 UTC):** `thrill-offsite` copies new backups with rclone. It only ever adds files. Set it up once:
  - `sudo rclone config --config /opt/thrill/rclone.conf`, creating a remote whose key can only write to the bucket (Cloudflare R2 or Backblaze B2);
  - set `OFFSITE_REMOTE` (for example `r2:thrill-backups/db`) in `/opt/thrill/ops.env`;
  - give the bucket a lifecycle rule, for example keeping 90 days.
- **Restore test:** monthly, and after any database upgrade, on a separate machine with the steps in [RELEASE_AND_HANDOVER.md](RELEASE_AND_HANDOVER.md).

## 6. Monitoring

- **Uptime:** point an uptime monitor (Better Stack or UptimeRobot) at `https://thrillrwanda.com/api/health`. It answers `{"status":"ok","release":"sha-…"}` while the website and database are up.
- **Heartbeats** (healthchecks.io, free tier). Create three checks and put their URLs in the settings:
  - backup, as `BACKUP_HEARTBEAT_URL` in `.env`: daily, alerts on a failed or missing backup;
  - off-site copy, as `OFFSITE_HEARTBEAT_URL` in `ops.env`: daily;
  - server, as `WATCH_HEARTBEAT_URL` in `ops.env`: every 15 minutes. It alerts when disk use passes 80%, memory passes 90%, a container is down or unhealthy, or the server stops reporting.
- **Disk:** `thrill-cleanup` runs after every deploy and weekly. It keeps the last 4 releases' images, removes dangling images and old stopped containers, and expires optimised images not requested for 30 days. It never touches volumes or backups. GHCR keeps the newest 15 versions of each image ([`packages-cleanup.yml`](../.github/workflows/packages-cleanup.yml)).
- **Logs:** Docker's `local` driver keeps at most 5 × 10 MB per container.
- **Jobs:** Admin → Launch → readiness shows the last run of each scheduled job.
- **Cron routes:** `/api/cron/...` is closed to the internet by Caddy; only the scheduler inside the server calls it.

## 7. Updates and secrets

- **Dependencies:** Dependabot proposes npm, GitHub Actions, base image and Postgres/Caddy updates weekly. Each one is a PR that is validated, and merging it deploys it.
- **Postgres:** minor versions are a tag change in `compose.yml`. A major version needs a dump and restore, never just a new tag.
- **Server packages:** security updates install automatically, with reboots at 03:30 UTC if needed. The containers come back on their own.
- **Secret rotation:** rotate the deploy key, `CRON_SECRET`, `BETTER_AUTH_SECRET` and `POSTGRES_PASSWORD` yearly, or when someone leaves.
  - For a new deploy key, replace the key in `~deploy/.ssh/authorized_keys` (keep the `restrict,command=...` prefix) and the `VPS_SSH_KEY` secret.
  - Changing `BETTER_AUTH_SECRET` signs everyone out.
  - `POSTGRES_PASSWORD` must be changed inside Postgres as well (`ALTER USER thrill PASSWORD ...`) before the new value goes in `.env`.

## 8. After moving

When the domain points at the VPS and the site works there:

- Update the approved UrubutoPay callback origin and the domain in Resend. Follow the [merchant setup](URUBUTOPAY_SETUP.md).
- Remove the Neon database, and the Vercel project or its domain and crons, so there is
  only one live copy of the site and its data.

## Trying the production setup locally

```sh
cd deploy && cp .env.example .env    # fill in; SITE_DOMAIN=localhost gives a local certificate
RELEASE=local docker compose -f compose.yml -f compose.build.yml up -d --build
```
