#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 server for Thrill Rwanda (Phase 1 of
# docs/VPS_ROLLOUT_PLAN.md). Safe to run again; each step checks first.
#
# From your machine:
#   scp -r deploy root@SERVER:/root/thrill-deploy
#   ssh root@SERVER
#   OPS_SSH_KEY="ssh-ed25519 AAAA... you@laptop" \
#   DEPLOY_SSH_KEY="ssh-ed25519 AAAA... github-actions-deploy" \
#   ACME_EMAIL="owner@thrillrwanda.com" \
#   bash /root/thrill-deploy/server/bootstrap.sh
#
# KEEP THIS ROOT SESSION OPEN until you have logged in as "ops" from a second
# terminal: this script turns off root and password logins.
set -Eeuo pipefail

: "${OPS_SSH_KEY:?set OPS_SSH_KEY to your own public key (for the ops admin user)}"
: "${DEPLOY_SSH_KEY:?set DEPLOY_SSH_KEY to the public half of the GitHub Actions deploy key}"
: "${ACME_EMAIL:?set ACME_EMAIL to the address for certificate notices}"
SITE_DOMAIN=${SITE_DOMAIN:-thrillrwanda.com}
SWAP_SIZE=${SWAP_SIZE:-2G}
HERE=$(cd "$(dirname "$0")/.." && pwd) # the copied deploy/ folder
ROOT=/opt/thrill

step() { printf '\n==> %s\n' "$*"; }
[ "$(id -u)" = 0 ] || { echo "Run as root." >&2; exit 1; }
. /etc/os-release
[ "$ID" = ubuntu ] && [ "${VERSION_ID%%.*}" -ge 24 ] || { echo "Written for Ubuntu 24.04 or later (found $PRETTY_NAME)." >&2; exit 1; }
for key in "$OPS_SSH_KEY" "$DEPLOY_SSH_KEY"; do
  [[ "$key" =~ ^(ssh-ed25519|ecdsa-sha2-nistp256|ssh-rsa)\ [A-Za-z0-9+/=]+ ]] || { echo "Not a public key: $key" >&2; exit 1; }
done
[ "$OPS_SSH_KEY" != "$DEPLOY_SSH_KEY" ] || { echo "Use a separate key for deploys." >&2; exit 1; }

step "Packages and security updates"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get -y -q full-upgrade
apt-get -y -q install ca-certificates curl gnupg ufw fail2ban unattended-upgrades rclone jq

step "Users: ops (people, sudo) and deploy (GitHub Actions, no shell)"
id ops >/dev/null 2>&1 || adduser --disabled-password --gecos "Thrill Rwanda operator" ops
usermod -aG sudo ops
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "Thrill Rwanda deploys" deploy
install -d -m 700 -o ops -g ops /home/ops/.ssh
grep -qxF "$OPS_SSH_KEY" /home/ops/.ssh/authorized_keys 2>/dev/null || echo "$OPS_SSH_KEY" >>/home/ops/.ssh/authorized_keys
chown ops:ops /home/ops/.ssh/authorized_keys && chmod 600 /home/ops/.ssh/authorized_keys
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
# Forced command: this key can only ask deploy-gate for deploy, rollback or status.
echo "restrict,command=\"$ROOT/bin/deploy-gate\" $DEPLOY_SSH_KEY" >/home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys
if passwd -S ops | awk '{exit ($2 == "P") ? 1 : 0}'; then
  echo "Choose a password for ops. It is only for sudo; SSH stays key-only."
  passwd ops
fi

step "SSH: keys only, no root"
cat >/etc/ssh/sshd_config.d/10-thrill-hardening.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
AllowUsers ops deploy
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
EOF
sshd -t
systemctl reload ssh

step "Firewall: SSH (rate limited), HTTP, HTTPS"
ufw default deny incoming
ufw default allow outgoing
ufw limit 22/tcp comment ssh
ufw allow 80/tcp comment http
ufw allow 443/tcp comment https
ufw allow 443/udp comment http3
ufw --force enable

step "Automatic security updates (reboot window 03:30 UTC if needed)"
cat >/etc/apt/apt.conf.d/52thrill-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:30";
EOF

step "fail2ban for SSH"
cat >/etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban >/dev/null
systemctl restart fail2ban

step "Docker Engine and Compose, from Docker's own repository"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get -y -q install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
install -d /etc/docker
cat >/etc/docker/daemon.json <<'EOF'
{
  "log-driver": "local",
  "log-opts": { "max-size": "10m", "max-file": "5" },
  "live-restore": true,
  "no-new-privileges": true,
  "userland-proxy": false
}
EOF
systemctl restart docker
usermod -aG docker deploy

step "Swap ($SWAP_SIZE) and kernel network settings"
if ! swapon --show | grep -q .; then
  fallocate -l "$SWAP_SIZE" /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi
cat >/etc/sysctl.d/90-thrill.conf <<'EOF'
vm.swappiness = 10
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.all.rp_filter = 2
net.ipv4.conf.all.log_martians = 1
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
EOF
sysctl --system >/dev/null

step "$ROOT: scripts, settings, backups"
install -d -m 750 -o deploy -g deploy "$ROOT" "$ROOT/bin" "$ROOT/caddy"
# The backup job runs as uid 1000 (node) inside its container.
install -d -m 700 -o 1000 -g 1000 "$ROOT/backups"
for script in "$HERE"/bin/*; do install -m 750 -o deploy -g deploy "$script" "$ROOT/bin/"; done
[ -f "$ROOT/compose.yml" ] || install -m 640 -o deploy -g deploy "$HERE/compose.yml" "$ROOT/compose.yml"
[ -f "$ROOT/caddy/Caddyfile" ] || install -m 644 -o deploy -g deploy "$HERE/caddy/Caddyfile" "$ROOT/caddy/Caddyfile"

if [ ! -f "$ROOT/.env" ]; then
  install -m 600 -o deploy -g deploy "$HERE/.env.example" "$ROOT/.env"
  fill() { sed -i "s|^$1=.*|$1=$2|" "$ROOT/.env"; }
  fill POSTGRES_PASSWORD "$(openssl rand -hex 32)"
  fill BETTER_AUTH_SECRET "$(openssl rand -hex 32)"
  fill CRON_SECRET "$(openssl rand -hex 32)"
  BACKUP_KEY=$(openssl rand -base64 32)
  fill BACKUP_ENCRYPTION_KEY "$BACKUP_KEY"
  fill SITE_DOMAIN "$SITE_DOMAIN"
  fill NEXT_PUBLIC_SITE_URL "https://$SITE_DOMAIN"
  fill BETTER_AUTH_URL "https://$SITE_DOMAIN"
  fill ACME_EMAIL "$ACME_EMAIL"
  NEW_BACKUP_KEY=1
fi
if [ ! -f "$ROOT/ops.env" ]; then
  install -m 640 -o root -g deploy /dev/null "$ROOT/ops.env"
  cat >"$ROOT/ops.env" <<'EOF'
# Host-only settings for thrill-watch and thrill-offsite (not given to containers).
# Heartbeat URLs from healthchecks.io (or similar): one check per line below.
WATCH_HEARTBEAT_URL=
DISK_ALERT_PERCENT=80
MEMORY_ALERT_PERCENT=90
# rclone remote and path, e.g. r2:thrill-backups/db  (configure with:
#   rclone config --config /opt/thrill/rclone.conf)
OFFSITE_REMOTE=
OFFSITE_HEARTBEAT_URL=
EOF
fi

step "Timers: watch (15 min), off-site copy (daily), cleanup (weekly)"
install -m 644 "$HERE"/server/systemd/*.service "$HERE"/server/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now thrill-watch.timer thrill-offsite.timer thrill-cleanup.timer >/dev/null

step "Done"
ip4=$(curl -fsS -4 -m 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
cat <<EOF

Next steps (docs/VPS_ROLLOUT_PLAN.md):

 1. In a NEW terminal, check you can log in before closing this one:
      ssh ops@$ip4      then:  sudo -v

 2. GitHub repository secrets (Settings > Secrets and variables > Actions):
      VPS_HOST         $ip4
      VPS_KNOWN_HOSTS  $ip4 $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)
      VPS_SSH_KEY      the PRIVATE half of the deploy key (never stored on this server)

 3. Fill in the remaining values in $ROOT/.env (Resend, Cloudinary, Duffel, mail ...):
      sudo -u deploy nano $ROOT/.env

 4. DNS at Spaceship: A @ and A www -> $ip4 (leave MX and TXT records alone).
EOF
if [ "${NEW_BACKUP_KEY:-0}" = 1 ]; then
  cat <<EOF

 5. SAVE THIS BACKUP KEY in the owner's password manager now. Without it no
    backup can ever be opened. It is also in $ROOT/.env.
      BACKUP_ENCRYPTION_KEY=$BACKUP_KEY
EOF
fi
