// Runs once when each Next.js server instance starts.
export async function register() {
  // Plain-language validation messages for every zod schema (see the module).
  await import("./lib/zod-messages");
}
