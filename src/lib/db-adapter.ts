import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

// Picks the Prisma driver from the connection string, so moving between Neon
// and a self-hosted Postgres is an env change, not a code change.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", ""]);

function parse(connectionString: string) {
  try {
    return new URL(connectionString);
  } catch {
    return null;
  }
}

export function isNeonUrl(connectionString: string) {
  return parse(connectionString)?.hostname.toLowerCase().endsWith(".neon.tech") ?? false;
}

/** Standard Postgres pool settings for a self-hosted server. */
export function pgPoolConfig(connectionString: string) {
  const url = parse(connectionString);
  const local = url ? LOCAL_HOSTS.has(url.hostname.toLowerCase()) : false;
  const sslInUrl = url?.searchParams.has("sslmode") ?? false;


  const mode = url?.searchParams.get("sslmode");
  if (url && (mode === "prefer" || mode === "require" || mode === "verify-ca")) {
    url.searchParams.set("sslmode", "verify-full");
  }

  return {
    connectionString: url ? url.toString() : connectionString,
    // Off-box connections are encrypted and the certificate is verified. An
    // sslmode in the URL is left to pg, so any exception is visible there.
    ...(local || sslInUrl ? {} : { ssl: true }),
    // Small on purpose: each serverless instance holds its own pool, and the
    // server's max_connections is shared by all of them.
    max: Number(process.env.DATABASE_POOL_MAX) || 5,
    // Reuse connections for a few minutes instead of reopening after 10s idle: every
    // reconnect burns a local port, and Windows dev machines run out (EADDRNOTAVAIL).
    idleTimeoutMillis: 300_000,
    // Keeps idle connections alive through routers and firewalls that drop silent ones.
    keepAlive: true,
    connectionTimeoutMillis: 10_000,
  };
}

export function adapterFor(connectionString: string) {
  return isNeonUrl(connectionString)
    ? new PrismaNeon({ connectionString })
    : new PrismaPg(pgPoolConfig(connectionString));
}
