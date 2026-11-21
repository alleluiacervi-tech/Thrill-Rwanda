#!/usr/bin/env sh
# Deploy the latest main on the VPS: pull, rebuild, migrate, restart.
# Run from the repository folder on the server:  sh deploy/update.sh
set -eu
cd "$(dirname "$0")"
git -C .. pull --ff-only
docker compose build
docker compose up -d --remove-orphans
docker image prune -f >/dev/null
docker compose ps
echo "Health: $(docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(console.log)")"
