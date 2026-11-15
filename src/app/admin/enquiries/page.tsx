import { EnquiryList } from "@/components/dashboard/enquiry-workspace";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <EnquiryList params={await searchParams} base="/admin/enquiries" />;
}
