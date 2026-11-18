"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, twoFactorClient } from "better-auth/client/plugins";
// Type-only import — this never pulls server code into the client bundle,
// but it does teach the client about `role`, `phone` and `isActive`.
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  // Blank or unset means "the site I am on", which also keeps Vercel preview URLs working.
  baseURL: process.env.NEXT_PUBLIC_SITE_URL?.trim() || undefined,
  plugins: [
    inferAdditionalFields<typeof auth>(),
    // The sign-in form handles the second step itself (see sign-in-form.tsx).
    twoFactorClient(),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
  changePassword,
  getSession,
  twoFactor,
} = authClient;
