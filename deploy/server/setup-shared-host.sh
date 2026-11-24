#!/usr/bin/env bash
# Adds Thrill Rwanda to a server that already runs other sites behind its own
# Caddy (the current VPS hosts ora.luxury, sawacars.com and api.ubirwanda.cloud).
#
# It only ADDS, and never changes or removes, anything that belongs to the
# server or to another project. It does not touch SSH settings, the
# firewall, Docker's settings, other users, other containers or other Caddy
# sites. Everything it creates is named "thrill":
#   user thrill (deploys only, forced command)  /opt/thrill
#   systemd thrill-*.timer                      /etc/caddy/sites/thrillrwanda.caddy
#   docker compose project "thrill" (created by the first deploy)
# Safe to run again; each step checks first.
#
#   scp -r deploy root@SERVER:/root/thrill-deploy
#   DEPLOY_SSH_KEY="ssh-ed25519 AAAA... github-actions-deploy" \
#     bash /root/thrill-deploy/server/setup-shared-host.sh
# After DNS points at the server, add the site to the server's Caddy:
#   INSTALL_SITE=1 bash /root/thrill-deploy/server/setup-shared-host.sh
set -Eeuo pipefail

HERE=$(cd "$(dirname "$0")/.." && pwd) # the copied deploy/ folder
ROOT=/opt/thrill
USER_NAME=thrill
SITE_FILE=/etc/caddy/sites/thrillrwanda.caddy

step() { printf '\n==> %s\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "Run as root." >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker is not installed on this server." >&2; exit 1; }
docker compose version >/dev/null || { echo "The Docker Compose plugin is missing." >&2; exit 1; }

if [ -n "${DEPLOY_SSH_KEY:-}" ]; then
  [[ "$DEPLOY_SSH_KEY" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+ ]] || { echo "DEPLOY_SSH_KEY is not an ed25519 public key." >&2; exit 1; }
fi

step "User $USER_NAME: deploys only (forced command, no shell)"
if ! id "$USER_NAME" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "Thrill Rwanda deploys" "$USER_NAME" >/dev/null
fi
usermod -aG docker "$USER_NAME"
install -d -m 700 -o "$USER_NAME" -g "$USER_NAME" "/home/$USER_NAME/.ssh"
if [ -n "${DEPLOY_SSH_KEY:-}" ]; then
  echo "restrict,command=\"$ROOT/bin/deploy-gate\" $DEPLOY_SSH_KEY" >"/home/$USER_NAME/.ssh/authorized_keys"
  chown "$USER_NAME:$USER_NAME" "/home/$USER_NAME/.ssh/authorized_keys"
  chmod 600 "/home/$USER_NAME/.ssh/authorized_keys"
fi

step "$ROOT: scripts, settings, backups"
install -d -m 750 -o "$USER_NAME" -g "$USER_NAME" "$ROOT" "$ROOT/bin"
# 755: the proxy container reads its Caddyfile here with every capability
# dropped, so even its root user needs the folder open. Nothing secret in it.
install -d -m 755 -o "$USER_NAME" -g "$USER_NAME" "$ROOT/caddy"
# The backup job runs as uid 1000 (node) inside its container. On this server
# uid 1000 is another user, so only that uid (and root) can read the folder.
install -d -m 700 -o 1000 -g 1000 "$ROOT/backups"
for script in "$HERE"/bin/*; do install -m 750 -o "$USER_NAME" -g "$USER_NAME" "$script" "$ROOT/bin/"; done
[ -f "$ROOT/compose.yml" ] || install -m 640 -o "$USER_NAME" -g "$USER_NAME" "$HERE/compose.yml" "$ROOT/compose.yml"
[ -f "$ROOT/caddy/Caddyfile" ] || install -m 644 -o "$USER_NAME" -g "$USER_NAME" "$HERE/caddy/Caddyfile" "$ROOT/caddy/Caddyfile"

NEW_BACKUP_KEY=0
if [ ! -f "$ROOT/.env" ]; then
  install -m 600 -o "$USER_NAME" -g "$USER_NAME" "$HERE/.env.example" "$ROOT/.env"
  fill() { sed -i "s|^$1=.*|$1=$2|" "$ROOT/.env"; }
  fill POSTGRES_PASSWORD "$(openssl rand -hex 32)"
  fill BETTER_AUTH_SECRET "$(openssl rand -hex 32)"
  fill CRON_SECRET "$(openssl rand -hex 32)"
  BACKUP_KEY=$(openssl rand -base64 32)
  fill BACKUP_ENCRYPTION_KEY "$BACKUP_KEY"
  NEW_BACKUP_KEY=1
fi
if [ ! -f "$ROOT/ops.env" ]; then
  install -m 640 -o root -g "$USER_NAME" /dev/null "$ROOT/ops.env"
  cat >"$ROOT/ops.env" <<'EOF'
# Host-only settings for thrill-watch and thrill-offsite (not given to containers).
# Heartbeat URLs from healthchecks.io (or similar).
WATCH_HEARTBEAT_URL=
DISK_ALERT_PERCENT=80
MEMORY_ALERT_PERCENT=90
# rclone remote and path, e.g. r2:thrill-backups/db  (configure with:
#   apt install rclone && rclone config --config /opt/thrill/rclone.conf)
OFFSITE_REMOTE=
OFFSITE_HEARTBEAT_URL=
EOF
fi

step "Timers: thrill-watch (15 min), thrill-offsite (daily), thrill-cleanup (weekly)"
install -m 644 "$HERE"/server/systemd/thrill-*.service "$HERE"/server/systemd/thrill-*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now thrill-watch.timer thrill-offsite.timer thrill-cleanup.timer >/dev/null

if [ "${INSTALL_SITE:-0}" = 1 ]; then
  step "thrillrwanda.com on the server's Caddy (checked before reloading)"
  grep -q 'import /etc/caddy/sites/\*' /etc/caddy/Caddyfile || { echo "/etc/caddy/Caddyfile does not import /etc/caddy/sites/*; add the site by hand." >&2; exit 1; }
  previous=""
  [ -f "$SITE_FILE" ] && previous=$(mktemp) && cp "$SITE_FILE" "$previous"
  restore() { if [ -n "$previous" ]; then cp "$previous" "$SITE_FILE"; else rm -f "$SITE_FILE"; fi; }
  install -m 644 "$HERE/host-caddy/thrillrwanda.caddy" "$SITE_FILE"
  # Validate as the caddy user, so a file it could not open fails here too.
  if ! runuser -u caddy -- caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
    runuser -u caddy -- caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile || true
    restore
    echo "The new site did not validate; it was taken out again and Caddy was not reloaded." >&2
    exit 1
  fi
  # A reload is graceful: the other sites keep serving throughout. If Caddy
  # refuses it, it keeps the old configuration; take our file out again so a
  # later restart cannot fail because of it.
  if systemctl reload caddy; then
    echo "Caddy reloaded with thrillrwanda.com."
  else
    restore
    echo "Caddy refused the new configuration and kept the old one; the site file was taken out again." >&2
    exit 1
  fi
fi

step "Done"
ip4=$(hostname -I | awk '{print $1}')
cat <<EOF

GitHub repository secrets (Settings > Secrets and variables > Actions):
  VPS_HOST         $ip4
  VPS_KNOWN_HOSTS  $ip4 $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)
  VPS_SSH_KEY      the PRIVATE half of the deploy key
Repository variables: VPS_USER=thrill, DEPLOY_ENABLED=true

Fill in the remaining settings (Resend, Cloudinary, Duffel, mail, payments):
  nano $ROOT/.env
EOF
if [ "$NEW_BACKUP_KEY" = 1 ]; then
  cat <<EOF

SAVE THIS BACKUP KEY in the password manager now. Without it no backup can
ever be opened. It is also in $ROOT/.env.
  BACKUP_ENCRYPTION_KEY=$BACKUP_KEY
EOF
fi
