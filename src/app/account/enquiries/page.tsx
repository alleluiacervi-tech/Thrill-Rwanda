import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { paginate } from "@/lib/pagination";
import { Pagination } from "@/components/ui/pagination";
import { clientScope, clientCases } from "@/lib/client-portal";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/account/enquiries"),
    params = await searchParams;
  const page = paginate(
    params,
    await db.enquiry.count({ where: clientScope(user.id) }),
  );
  const rows = await clientCases(user.id, page.skip, page.take);
  return (
    <>
      <DashboardHead
        title="My travel requests"
        lede="Your verified request and quotation history. Guest requests appear only after the desk verifies identity and grants access; an email match does not link them automatically."
      />
      {rows.length ? (
        <ul className="space-y-4">
          {rows.map((e) => (
            <li
              key={e.reference}
              className="rounded-xl border border-[var(--line)] p-5"
            >
              <Link
                className="underline"
                href={`/account/enquiries/${e.reference}`}
              >
                {e.reference}
              </Link>
              <p>
                {e.service} · {e.status.replaceAll("_", " ")} ·{" "}
                {e.createdAt.toLocaleDateString("en-GB")}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No requests have been shared with this account yet. Contact the desk
          with your saved reference to arrange identity verification.
        </p>
      )}
      <Pagination
        page={page}
        pathname="/account/enquiries"
        params={params}
        label="travel requests"
      />
      <p className="mt-7">
        <Link href="/support" className="underline">
          Contact the travel desk
        </Link>
      </p>
    </>
  );
}
