import { TicketingCase } from "@/components/ticketing/ticketing-case";
export default async function Page({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  return <TicketingCase reference={(await params).reference} base="/admin/ticketing" />;
}
