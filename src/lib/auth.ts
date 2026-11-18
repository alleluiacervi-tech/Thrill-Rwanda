import { resetDeliveryNotice } from "@/lib/auth-notice";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { db } from "@/lib/db";
import { site } from "@/lib/site";

/**
 * Better Auth — email/password with three roles (Step 3).
 *
 * Two deliberate choices worth keeping:
 *
 * 1. `role` is declared with `input: false`. Without it, Better Auth accepts
 *    any additionalField from the sign-up request body, so anyone could POST
 *    `role: "ADMIN"` and self-promote. Role changes must go through the
 *    admin dashboard (Step 13) or a direct DB write — never a public form.
 *
 * 2. Providers are NOT created here. Signing up as a provider creates a
 *    CUSTOMER user plus a Provider row in PENDING; an admin promotes the
 *    role on approval. See `requestProviderAccount` in
 *    src/app/actions/auth.ts.
 */

const secret = process.env.BETTER_AUTH_SECRET;

if (!secret && process.env.NODE_ENV === "production") {
  throw new Error(
    "BETTER_AUTH_SECRET is not set. Generate one with: openssl rand -base64 32",
  );
}

export const auth = betterAuth({
  appName: site.name,
  secret: secret ?? "dev-only-insecure-secret-change-me",
  // Blank or unset: Better Auth works it out from each request instead of pinning localhost in production.
  baseURL: process.env.BETTER_AUTH_URL?.trim() || undefined,

  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    // Verification email delivery arrives with Step 15. Until then, don't
    // lock people out of an account they just created.
    requireEmailVerification: false,
    async sendResetPassword({ user, url }) {
      const apiKey = process.env.RESEND_API_KEY;
      const from = process.env.EMAIL_FROM;

      if (!apiKey || !from) {
        console.warn(resetDeliveryNotice(process.env.NODE_ENV, url));
        return;
      }

      const { renderEmail, sendRendered } = await import("@/lib/email/template");
      const brand = await (await import("@/lib/settings")).getSite();
      await sendRendered(
        user.email,
        renderEmail({
          subject: `Reset your ${brand.name} password`,
          heading: "Reset your password",
          preheader: "Use the button inside to choose a new password. The link expires in one hour.",
          name: user.name,
          paragraphs: ["We received a request to reset the password on your account. Choose a new one using the button below."],
          cta: { label: "Choose a new password", href: url },
          note: "This link expires in one hour and works once. If you didn't ask for it, ignore this email and your password stays the same.",
        }, brand),
      );
    },
  },

  user: {
    modelName: "User",
    // Better Auth's `name` maps to our domain column `fullName`.
    fields: { name: "fullName" },
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "CUSTOMER",
        // Not settable from the sign-up request. See note 1 above.
        input: false,
      },
      phone: {
        type: "string",
        required: false,
        input: true,
      },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
        input: false,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once a day
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  advanced: {
    // Deactivated accounts keep their rows (bookings reference them) but
    // must not be able to hold a session.
    database: { generateId: false },
  },

  hooks: {
    // Administrators and staff cannot switch two-step sign-in off for
    // themselves; a super admin can reset it for them (Users & access).
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/two-factor/disable") return;
      const session = await getSessionFromCtx(ctx);
      if (!session) return;
      const { db } = await import("@/lib/db");
      const { twoFactorRequired } = await import("@/lib/two-factor-policy");
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, staffRole: true },
      });
      if (user && twoFactorRequired(user))
        throw new APIError("FORBIDDEN", {
          message: "Two-step sign-in is required for administrators and staff, so it can't be switched off.",
        });
    }),
  },

  databaseHooks: {
    // Team sign-ins go in the activity log, so access can be traced to a person and a time.
    session: {
      create: {
        after: async (session, context) => {
          const { db } = await import("@/lib/db");
          const user = await db.user.findUnique({
            where: { id: session.userId },
            select: { role: true, staffRole: true, twoFactorEnabled: true },
          });
          if (!user || (user.role === "CUSTOMER" && !user.staffRole)) return;
          // With two-step sign-in on, the password step opens a session that is
          // closed again until the code is checked (unless the device is trusted),
          // so the log says which step this was.
          const path = context?.path ?? "";
          const summary = path.startsWith("/two-factor/verify-backup-code")
            ? "Signed in with a backup code"
            : path.startsWith("/two-factor/")
              ? "Signed in with an authenticator code"
              : user.twoFactorEnabled
                ? "Password accepted; signed in if this is a trusted device, otherwise asked for the authenticator code"
                : "Signed in with a password";
          const { logActivity } = await import("@/lib/activity");
          await logActivity(session.userId, { action: "auth.sign_in", area: "Sign-in", summary });
        },
      },
    },
    user: {
      // Turning two-step sign-in on or off goes in the activity log.
      update: {
        after: async (user, context) => {
          const path = context?.path ?? "";
          if (!path.startsWith("/two-factor/")) return;
          const on = (user as { twoFactorEnabled?: boolean }).twoFactorEnabled;
          if (on === undefined) return;
          const { logActivity } = await import("@/lib/activity");
          await logActivity(user.id, {
            action: on ? "auth.two_factor_on" : "auth.two_factor_off",
            area: "Sign-in",
            target: (user as { name?: string }).name ?? null,
            targetId: user.id,
            summary: on ? "Turned on two-step sign-in (authenticator app)" : "Turned off two-step sign-in",
          });
        },
      },
      create: {
        // Fired after the row exists. Notifications never throw, so a mail
        // failure can't break sign-up.
        after: async (user) => {
          const { notifyWelcome } = await import("@/lib/notifications");
          await notifyWelcome(user.id);
        },
      },
    },
  },

  plugins: [
    // Two-step sign-in with an authenticator app (scan a QR code), backup
    // codes, and "trust this device" for 30 days. Required for administrators
    // and staff (see requireTeamTwoFactor in src/lib/session.ts).
    twoFactor({
      issuer: site.name,
      trustDeviceMaxAge: 60 * 60 * 24 * 30,
      backupCodeOptions: { amount: 10, length: 10 },
    }),
    // Must be last — writes Set-Cookie from server actions.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
