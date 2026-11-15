import { SupportWorkspace } from "@/components/dashboard/support-workspace";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return <SupportWorkspace q={(await searchParams).q} />;
}
