import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { ServiceEnquiryForm } from "@/components/booking/service-enquiry-form";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { isFinance } from "@/lib/enquiry-workflow";
export default async function Page() {
  const actor = await requireEnquiryStaff();
  if (isFinance(actor)) redirect("/staff/enquiries");
  return (
    <>
      <DashboardHead
        title="Capture an enquiry"
        lede="Record an offline request and its permission evidence. No booking or payment is created."
      />
      <ServiceEnquiryForm submissionKey={randomUUID()} manual />
    </>
  );
}
