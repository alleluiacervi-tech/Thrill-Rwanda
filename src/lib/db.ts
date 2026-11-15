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
};

function createClient() {
  const adapter = adapterFor(connectionString!);
  return new PrismaClient({
    adapter,
    // Validation/driver exceptions can include bound customer values. Application handlers report safe outcomes.
    log: process.env.NODE_ENV === "development" ? ["warn"] : [],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
