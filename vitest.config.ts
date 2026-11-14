import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit tests only: the pure rules behind money and bookings.
 *
 * Nothing here touches the database or the network, so `npm test` runs in a
 * second and works offline — including when the VPS is unreachable.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      // The tests assert in whole shillings and UTC days; a stray timezone would hide a real bug.
      TZ: "UTC",
      // src/lib/db.ts refuses to load without this. A deliberately dead URL: these
      // tests call pure functions only, and Prisma connects lazily, so nothing dials out.
      // Pointing it at the real database would risk a test touching live bookings.
      DATABASE_URL: "postgresql://unit-tests:unused@127.0.0.1:1/unused",
    },
  },
});
