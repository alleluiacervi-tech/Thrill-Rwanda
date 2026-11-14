import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/session";

export default async function ProviderApplyPage() {
  await requireUser("/provider/apply");

  return (
    <>
      <DashboardHead
        title="Apply to list"
        lede="You're signed in, but this account isn't linked to a provider yet."
      />
      <div className="max-w-xl rounded-[var(--radius-card)] border border-dashed border-[var(--line-strong)] p-8">
        <p className="text-sm leading-relaxed text-[var(--ink-muted)]">
          The self-service provider application form arrives with the provider
          dashboard module (Step 12). Until then, send us your business name,
          what you operate and where, and we&rsquo;ll set the account up and
          verify it manually.
        </p>
        <Button
          href="/contact?subject=Provider%20application"
          variant="accent"
          className="mt-7"
        >
          Send your details
        </Button>
      </div>
    </>
  );
}
