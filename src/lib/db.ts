import { PrismaClient } from "@/generated/prisma/client";
import { adapterFor } from "@/lib/db-adapter";

// A Neon URL gets Neon's serverless driver; any other Postgres URL gets a
// small standard pg pool. See src/lib/db-adapter.ts.

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and add your Postgres connection string.",
  );
}

// Next dev reloads modules on every edit; without this each reload would
// build a new client and leak connections.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  /** The generated class `prisma` was built from. */
  prismaClass?: typeof PrismaClient;
};

function createClient() {
  const adapter = adapterFor(connectionString!);
  return new PrismaClient({
    adapter,
    // Validation/driver exceptions can include bound customer values. Application handlers report safe outcomes.
    log: process.env.NODE_ENV === "development" ? ["warn"] : [],
  });
}

// A migration regenerates the client. The global above outlives that, so a
// running dev server would keep a client that has never heard of the new
// tables or columns (queries fail, or quietly return rows without them) until
// it was restarted. When the generated class has changed, build a new client.
const outdated =
  !!globalForPrisma.prisma && globalForPrisma.prismaClass !== PrismaClient;
if (outdated) void globalForPrisma.prisma!.$disconnect().catch(() => {});

export const db =
  globalForPrisma.prisma && !outdated ? globalForPrisma.prisma : createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaClass = PrismaClient;
}
