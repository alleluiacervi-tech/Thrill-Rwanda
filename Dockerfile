# Thrill Rwanda on a VPS. Two images from one file:
#   app    - the website (Next.js standalone server, no dev tools, runs as a non-root user)
#   tools  - the full project, for migrations, backups, seeding and checks
# docker compose (deploy/compose.yml) builds both. See docs/VPS_DEPLOYMENT.md.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
# NEXT_PUBLIC_* values are fixed into the browser code at build time.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
# The build reads auth config; a throwaway secret is enough to compile, the
# real one is given at run time and never stored in the image.
# No database exists during the image build: pages that read it render on
# request, and the few prerendered pages fall back to the built-in defaults.
RUN BETTER_AUTH_SECRET=build-only-not-a-real-secret-0000000000 \
    DATABASE_URL=postgresql://build:build@127.0.0.1:1/build \
    npm run build

# --- tools: migrations, backups (pg_dump 17), seeds, checks ---------------
FROM build AS tools
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-17 \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
CMD ["npx", "prisma", "migrate", "deploy"]

# --- app: the website -----------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS app
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
