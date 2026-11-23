# syntax=docker/dockerfile:1.10
# Thrill Rwanda on a VPS. Two images from one file:
#   app    the website: the Next.js standalone server only, run as a non-root user
#   tools  migrations, the scheduler, backups and admin scripts, with no website build
# GitHub Actions builds and publishes both (.github/workflows/deploy.yml).
# See docs/VPS_DEPLOYMENT.md.

# Pinned by digest; Dependabot proposes updates (.github/dependabot.yml).
ARG NODE_IMAGE=node:24.22.3-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54

# --- deps: every package, for the build -----------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# --- build: the website ---------------------------------------------------
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

# --- runtime-deps: production packages only (prisma, tsx, pg, ...) --------
FROM ${NODE_IMAGE} AS runtime-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
# postinstall generates the Prisma client into src/generated/prisma.
# Next's compiler binaries are only needed to build, never by the scripts.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund \
 && rm -rf node_modules/@next/swc-*

# --- tools: migrations, scheduler, backups (pg_dump 17) -------------------
FROM ${NODE_IMAGE} AS tools
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-17 \
 && apt-get purge -y --auto-remove curl gnupg \
 && rm -rf /var/lib/apt/lists/*
COPY --from=runtime-deps --chown=node:node /app ./
COPY --chown=node:node tsconfig.json prisma7.config.ts ./
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node src ./src
# The server's deploy configuration ships inside the image it belongs to;
# deploy-gate copies it out, so the server never needs a git checkout.
COPY --chown=node:node deploy ./deploy
RUN install -d -o node -g node /app/.backups
ENV NODE_ENV=production \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    PATH=/app/node_modules/.bin:$PATH
# Declared last, so a new release changes only this layer.
ARG RELEASE=dev
ENV RELEASE=${RELEASE}
USER node
CMD ["prisma", "migrate", "deploy"]

# --- app: the website -----------------------------------------------------
FROM ${NODE_IMAGE} AS app
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Optimised images are kept in a volume here (deploy/compose.yml); the
# folder must exist and belong to node so the volume inherits that owner.
RUN install -d -o node -g node /app/.next/cache
ARG RELEASE=dev
ENV RELEASE=${RELEASE}
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
