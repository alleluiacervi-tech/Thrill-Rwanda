import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { PaymentRoutingForm } from "@/components/dashboard/payment-routing-form";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { getUrubutoProvider } from "@/lib/collections/urubuto";

export default async function PaymentRoutingPage() {
  await requireAdmin("/admin/payments/routing");
  const environment = process.env.APP_ENV === "production" ? "live" : "staging";
  const gateway = getUrubutoProvider();
  const [policy, verified] = await Promise.all([
    db.paymentRoutingPolicy.findUnique({ where: { environment } }),
    db.collectionAttempt.findFirst({
      where: { provider: "URUBUTOPAY", environment, verifiedAt: { not: null } },
      orderBy: { verifiedAt: "desc" }, select: { verifiedAt: true },
    }),
  ]);
  return (
    <>
      <DashboardHead title="Payment provider settings" lede={environment === "live" ? "Production routing" : "Testing routing"} action={<Button href="/admin/payments" variant="outline">Payment collections</Button>} />
      <div className="mb-5 space-y-2 text-sm">
        <p>UrubutoPay is the primary gateway for RWF. Bank transfer is available on cases with approved instructions.</p>
        <p>Merchant methods configured on the server {gateway?.provider.getCapabilities().methods.join(", ") || "pending"}.</p>
        <p>Last verified online collection {verified?.verifiedAt?.toLocaleString("en-GB", { timeZone: "Africa/Kigali" }) ?? "pending"}.</p>
        <p>Pausing stops new payment attempts. Existing attempts remain available for independent status verification.</p>
      </div>
      <PaymentRoutingForm policy={policy} configured={!!gateway?.enabled} />
    </>
  );
}
