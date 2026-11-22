import { ClientDirectory } from "@/components/dashboard/client-directory";
import type { Params } from "@/lib/table-query";

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  return <ClientDirectory base="/staff" params={await searchParams} />;
}
