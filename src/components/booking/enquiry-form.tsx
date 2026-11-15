"use client";
import { useSearchParams } from "next/navigation";
import { ServiceEnquiryForm } from "@/components/booking/service-enquiry-form";
/** Preserve catalogue handoff context while saving a durable service request. */
export function EnquiryForm({
  submissionKey,
  className,
}: {
  submissionKey: string;
  className?: string;
}) {
  const params = useSearchParams();
  const context = ["subject", "from", "to", "date", "time", "guests", "notes"]
    .map((key) => (params.get(key) ? `${key}: ${params.get(key)}` : ""))
    .filter(Boolean)
    .join("\n")
    .slice(0, 1000);
  return (
    <ServiceEnquiryForm
      submissionKey={submissionKey}
      context={context}
      className={className}
    />
  );
}
