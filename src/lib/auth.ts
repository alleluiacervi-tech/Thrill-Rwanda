import { resetDeliveryNotice } from "@/lib/auth-notice";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
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

  databaseHooks: {
    user: {
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

  // Must be last — writes Set-Cookie from server actions.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
