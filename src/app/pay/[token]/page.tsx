import { notFound } from "next/navigation";
import { CollectionCheckout } from "@/components/booking/collection-checkout";
import { PageShell } from "@/components/layout/page-shell";
import { collectionCheckout } from "@/lib/collections/checkout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pay an invoice", robots: { index: false, follow: false } };

export default async function PayInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{43}$/.test(token)) notFound();
  const data = await collectionCheckout({ token });
  if (!data) notFound();
  return <PageShell><CollectionCheckout data={data} token={token} /></PageShell>;
}
