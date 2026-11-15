import { EnquiryDetail } from "@/components/dashboard/enquiry-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  return (
    <EnquiryDetail
      reference={(await params).reference}
      base="/staff/enquiries"
    />
  );
}
