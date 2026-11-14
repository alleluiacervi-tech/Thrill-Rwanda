import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { redirectIfAuthenticated } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to manage your bookings.",
  robots: { index: false, follow: false },
};

export default async function SignInPage() {
  await redirectIfAuthenticated();

  return (
    <AuthShell
      title="Welcome back"
      lede="Sign in to see your bookings, payment status and confirmations."
      footer={
        <>
          New here?{" "}
          <Link href="/sign-up" className="link-draw font-medium text-lake-700">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="h-72" />}>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
