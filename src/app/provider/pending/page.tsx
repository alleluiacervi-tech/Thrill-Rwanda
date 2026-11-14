import { Clock3 } from "lucide-react";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function ProviderPendingPage() {
  const user = await requireUser("/provider");
  const provider = await db.provider.findUnique({
    where: { userId: user.id },
    select: { businessName: true, status: true },
  });

  if (!provider) redirect("/provider/apply");
  if (provider.status === "VERIFIED") redirect("/provider");

  const copy: Record<string, { title: string; body: string }> = {
    PENDING: {
      title: "Your application is with us",
      body: "We're checking your licence, insurance and KRA PIN, and arranging a visit or fleet inspection. This usually takes under two weeks.",
    },
    REJECTED: {
      title: "We couldn't approve this application",
      body: "Something in the verification didn't check out. Get in touch and we'll tell you exactly what's missing — most rejections are fixable.",
    },
    SUSPENDED: {
      title: "This account is suspended",
      body: "Your listings are hidden and new bookings are paused. Contact us to resolve it.",
    },
  };

  const state = copy[provider.status] ?? copy.PENDING;

  return (
    <>
      <DashboardHead title={provider.businessName} />
      <div className="max-w-xl rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-8">
        <span className="grid size-11 place-items-center rounded-full bg-clay-100 text-clay-700">
          <Clock3 className="size-5" />
        </span>
        <h2 className="mt-5 text-2xl">{state.title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--ink-muted)]">
          {state.body}
        </p>
        <Button href="/contact" variant="outline" className="mt-7">
          Contact the team
        </Button>
      </div>
    </>
  );
}
