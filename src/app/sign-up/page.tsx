import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpWizard } from "@/components/auth/sign-up-wizard";
import { redirectIfAuthenticated } from "@/lib/session";

export const metadata: Metadata = {
  title: "Create an account",
  description:
    "Create an account to book safaris, hotels, car hire and airport transfers — or apply to list your fleet or property.",
  robots: { index: false, follow: false },
};

export default async function SignUpPage() {
  await redirectIfAuthenticated();

  return (
    <AuthShell
      title="Create your account"
      lede="One account for safaris, hotels, car hire and transfers — with every booking in one place."
    >
      <Suspense fallback={<div className="h-96" />}>
        <SignUpWizard />
      </Suspense>
    </AuthShell>
  );
}
