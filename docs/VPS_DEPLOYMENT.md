# Running Thrill Rwanda on a VPS

Everything the site needs runs on one server with Docker:

| Container | What it does |
|---|---|
| `db` | PostgreSQL 17. Not reachable from the internet. |
| `migrate` | Applies database migrations on every start, then exits. |
| `app` | The website. |
| `scheduler` | Sends queued notifications every 5 minutes, makes the encrypted backup at 02:30, runs document maintenance at 04:00 and releases expired holds at 05:00 (Kigali time). |
| `caddy` | HTTPS. Gets and renews the certificate by itself. |

The files are in [`deploy/`](../deploy) and the [`Dockerfile`](../Dockerfile). Vercel
keeps working as before; nothing here changes it.

## 1. The server

- Ubuntu 24.04, at least 2 CPUs, 4 GB memory and 40 GB disk. The image build is
  the heaviest moment; with 2 GB, add a 4 GB swap file first.
- Install Docker: `curl -fsSL https://get.docker.com | sh`
- Firewall: allow only SSH, HTTP and HTTPS.
  `ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable`
- DNS: point the domain's `A` record and `www` at the server's IP address.
  Wait until `ping your-domain` shows that address, or Caddy can't get a
  certificate.

## 2. First start

```sh
git clone https://github.com/alleluiacervi-tech/Thrill-Rwanda.git thrill-rwanda
cd thrill-rwanda/deploy
cp .env.example .env
nano .env        # fill in every value; generate secrets with: openssl rand -hex 32
docker compose up -d --build
docker compose ps    # app "healthy", migrate "exited (0)"
```

Open `https://your-domain`. The first build takes several minutes.

Keep a copy of `BACKUP_ENCRYPTION_KEY` somewhere other than the server (a
password manager). Without it, backups cannot be opened.

## 3. The first super admin

Sign up on the website with the owner's email address, then on the server:

```sh
docker compose run --rm migrate npx tsx scripts/make-super-admin.ts owner@example.com
```

At their next sign-in they set up two-step sign-in (an authenticator app), and
from then on grant everyone else's access in Admin → Users & access. The
activity log records the change as made from the server console.

Do not run the demo seeds on this server.

## 4. Moving the data from Neon (optional)

Neon was a test database, so a clean start is usually right. To carry its data
over instead, before people start using the new site:

```sh
# On any machine with PostgreSQL 17 client tools; use Neon's direct (non-pooler) address.
pg_dump --format=custom --no-owner --no-acl "<neon direct url>" > neon.dump
# Copy neon.dump to the server, then:
docker compose stop app scheduler
docker compose cp neon.dump db:/tmp/neon.dump
docker compose exec db pg_restore --clean --if-exists --no-owner -U thrill -d thrill_rwanda /tmp/neon.dump
docker compose exec db rm /tmp/neon.dump
docker compose up -d
```

## 5. Updating

Every change merged to `main`:

```sh
cd thrill-rwanda && sh deploy/update.sh
```

It pulls, rebuilds, applies migrations and restarts. The site is unavailable
for the few seconds the new container takes to start.

## 6. Backups

Each night the scheduler writes an encrypted archive and a signed manifest to
`deploy/backups/`, and deletes ones older than `BACKUP_KEEP_DAYS` (14). A
backup on the same server does not survive losing the server, so copy the
folder off it each day, for example with `rclone` to company storage. The
files are encrypted, so ordinary storage is fine.

Test that a backup can be restored, monthly and after any database upgrade, on a
separate machine with the steps in [RELEASE_AND_HANDOVER.md](RELEASE_AND_HANDOVER.md).

## 7. Watching it

- `docker compose ps`: all containers up, `app` healthy.
- `docker compose logs -f scheduler`: one line per job run, for example
  `enquiry-notifications HTTP 200` and `backup ok`.
- `docker compose logs -f app caddy`: website and access logs.
- Point an uptime monitor (UptimeRobot, Better Stack) at
  `https://your-domain/api/health`. It answers `{"status":"ok"}` while the
  website and database are up.
- Admin → Launch → readiness shows the last run of each scheduled job.

The scheduled-job addresses (`/api/cron/...`) are closed to the internet by
Caddy; only the scheduler inside the server calls them.

## 8. After moving

When the domain points at the VPS and the site works there:

- Update the approved UrubutoPay callback origin and the domain in Resend. Follow the [merchant setup](URUBUTOPAY_SETUP.md).
- Remove the Neon database, and the Vercel project or its domain, so there is
  only one live copy of the site and its data.
