import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      lede="Choose something you don't use anywhere else."
      footer={
        <>
          <Link href="/sign-in" className="link-draw font-medium text-clay-700">
            Back to sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="h-64" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
