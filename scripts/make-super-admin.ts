/**
 * Makes an existing account a super admin. For the very first administrator
 * on a new server, run from the server console after that person has signed
 * up on the website:
 *
 *   docker compose run --rm migrate npx tsx scripts/make-super-admin.ts owner@example.com
 *
 * After that, super admins grant all other access from Admin → Users & access.
 * The change is written to the activity log as made from the server console.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { roleLabel } from "../src/lib/access";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Usage: npx tsx scripts/make-super-admin.ts <email of an account that has signed up>");
    process.exit(2);
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No account for ${email}. Sign up on the website first, then run this again.`);
    process.exit(1);
  }
  if (!user.isActive) {
    console.error(`${email} is deactivated. Reactivate it before granting access.`);
    process.exit(1);
  }
  if (user.role === "ADMIN" && user.isSuperAdmin) {
    console.log(`${email} is already a super admin.`);
    return;
  }
  const before = roleLabel(user);
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { role: "ADMIN", isSuperAdmin: true } }),
    db.activityLog.create({
      data: {
        actorId: null,
        actorName: "Server console",
        actorEmail: "",
        actorRole: "Server operator",
        action: "user.super_admin",
        area: "Access",
        target: user.fullName ?? email,
        targetId: user.id,
        summary: `Made ${user.fullName ?? email} a super admin from the server console`,
        changes: { email, before, after: "Super admin" },
      },
    }),
  ]);
  console.log(`${email} is now a super admin (was: ${before}). They will set up two-step sign-in at their next sign-in.`);
}

main()
  .catch((error) => {
    console.error("Could not update the account:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
