import { TicketingDesk } from "@/components/ticketing/ticketing-desk";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <TicketingDesk params={await searchParams} base="/admin/ticketing" />;
}
