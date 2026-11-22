import { redirect } from "next/navigation";
import { CollectionRegister } from "@/components/dashboard/collection-register";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { canFinance } from "@/lib/finance-rules";
import type { PaymentQuery } from "@/lib/collections/register";

export default async function FinanceCollectionsPage({ searchParams }: { searchParams: Promise<PaymentQuery> }) {
  const actor = await requireEnquiryStaff();
  if (!canFinance(actor)) redirect("/staff/enquiries");
  return <CollectionRegister raw={await searchParams} admin={false} />;
}
