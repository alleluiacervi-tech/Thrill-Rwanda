import { randomUUID } from "node:crypto";
import { ServiceEnquiryForm } from "@/components/booking/service-enquiry-form";
export function CorporateRateForm({ className }: { className?: string }) {
  return (
    <ServiceEnquiryForm
      submissionKey={randomUUID()}
      initialService="GROUP"
      context="Corporate travel enquiry"
      className={className}
    />
  );
}
