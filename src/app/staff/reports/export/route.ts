import { getCurrentUser } from "@/lib/session";
import { reportCsv } from "@/lib/operations-report";
import { canUseEnquiries } from "@/lib/enquiry-workflow";
import { OperationsError } from "@/lib/launch-rules";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canUseEnquiries(user))
    return new Response("Access denied", { status: 403 });
  const q = new URL(request.url).searchParams;
  try {
    return new Response(
      await reportCsv(
        user,
        q.get("kind") ?? "operations",
        q.get("from") ?? undefined,
        q.get("to") ?? undefined,
      ),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=thrill-report.csv",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (e) {
    if (e instanceof OperationsError)
      return new Response(e.message, { status: 400 });
    throw e;
  }
}
