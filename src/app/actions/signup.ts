"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyProviderApplication } from "@/lib/notifications";
import {
  ACCOUNT_TYPES,
  providerKindFor,
  type AccountType,
} from "@/lib/account-types";
import { slugify } from "@/lib/utils";

/**
 * Multi-step sign-up (Step 3, revisited).
 *
 * Everyone who signs up becomes a CUSTOMER, whichever path they take.
 * Choosing "Car provider" or "Hotel owner" additionally files a Provider
 * application in PENDING — it does NOT grant the PROVIDER role. Only an
 * admin approving the application does that (see `setProviderStatus`).
 *
 * That separation is the point: if this action could hand out roles, the
 * `input: false` lock on `role` in src/lib/auth.ts would be pointless,
 * because anyone could self-promote by ticking a radio button.
 */

const personal = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().min(7, "Phone number is required").max(40),
  password: z.string().min(10, "Use at least 10 characters").max(128),
  confirm: z.string(),
  terms: z.literal("on", {
    message: "Please accept the terms to continue",
  }),
});

const business = z.object({
  businessName: z.string().trim().min(2, "Business name is required").max(160),
  registrationNumber: z.string().trim().max(60).optional().or(z.literal("")),
  taxId: z.string().trim().max(40).optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is required").max(80),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type SignUpState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; accountType: AccountType };

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** Business name → unique slug, with a numeric suffix on collision. */
async function uniqueProviderSlug(businessName: string) {
  const base = slugify(businessName) || "provider";
  let candidate = base;
  for (let i = 2; i < 50; i++) {
    const taken = await db.provider.count({ where: { slug: candidate } });
    if (taken === 0) return candidate;
    candidate = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export async function submitSignUp(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const accountType = String(formData.get("accountType") ?? "");
  if (!ACCOUNT_TYPES.includes(accountType as AccountType)) {
    return { status: "error", message: "Please choose an account type." };
  }
  const type = accountType as AccountType;
  const isProvider = type !== "CLIENT";

  const parsedPersonal = personal.safeParse({
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    password: formData.get("password") ?? "",
    confirm: formData.get("confirm") ?? "",
    terms: formData.get("terms") ?? "",
  });

  if (!parsedPersonal.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: fieldErrors(parsedPersonal.error),
    };
  }

  const p = parsedPersonal.data;
  if (p.password !== p.confirm) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: { confirm: "Passwords don't match." },
    };
  }

  let biz: z.infer<typeof business> | null = null;
  if (isProvider) {
    const parsedBusiness = business.safeParse({
      businessName: formData.get("businessName") ?? "",
      registrationNumber: formData.get("registrationNumber") ?? "",
      taxId: formData.get("taxId") ?? "",
      city: formData.get("city") ?? "",
      address: formData.get("address") ?? "",
      description: formData.get("description") ?? "",
    });
    if (!parsedBusiness.success) {
      return {
        status: "error",
        message: "Please check the highlighted fields.",
        fieldErrors: fieldErrors(parsedBusiness.error),
      };
    }
    biz = parsedBusiness.data;
  }

  const fullName = `${p.firstName} ${p.lastName}`.trim();

  // Better Auth owns password hashing; `role` is never sent (input: false).
  try {
    await auth.api.signUpEmail({
      body: { email: p.email, password: p.password, name: fullName },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/exist/i.test(message)) {
      return {
        status: "error",
        message: "An account with that email already exists. Try signing in.",
        fieldErrors: { email: "Already registered." },
      };
    }
    console.error("[signup] account creation failed", err);
    return {
      status: "error",
      message: "We couldn't create that account. Please try again.",
    };
  }

  const user = await db.user.findUnique({
    where: { email: p.email },
    select: { id: true },
  });
  if (!user) {
    return { status: "error", message: "Account created but not found. Contact us." };
  }

  await db.user.update({ where: { id: user.id }, data: { phone: p.phone } });

  if (isProvider && biz) {
    try {
      const provider = await db.provider.create({
        data: {
          userId: user.id,
          businessName: biz.businessName,
          slug: await uniqueProviderSlug(biz.businessName),
          kind: providerKindFor(type)!,
          phone: p.phone,
          city: biz.city,
          address: biz.address || null,
          about: biz.description || null,
          licenceNumber: biz.registrationNumber || null,
          kraPin: biz.taxId || null,
          // PENDING, always. The role stays CUSTOMER until an admin approves.
          status: "PENDING",
        },
        select: { id: true },
      });
      await notifyProviderApplication(provider.id);
    } catch (err) {
      // The account exists and is usable as a customer; only the application
      // failed. Say so rather than implying the whole sign-up died.
      console.error("[signup] provider application failed", err);
      return {
        status: "error",
        message:
          "Your account was created, but we couldn't file the business application. Sign in and contact us and we'll finish it.",
      };
    }
  }

  return { status: "success", accountType: type };
}
