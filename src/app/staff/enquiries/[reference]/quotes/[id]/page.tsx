import { QuoteDocument } from "@/components/dashboard/quote-document";
export default async function Page({
  params,
}: {
  params: Promise<{ reference: string; id: string }>;
}) {
  const { reference, id } = await params;
  return (
    <QuoteDocument reference={reference} id={id} base="/staff/enquiries" />
  );
}
