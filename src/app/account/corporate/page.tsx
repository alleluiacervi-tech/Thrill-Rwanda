import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
export default async function Page() {
  const user = await requireUser("/account/corporate"),
    members = await db.corporateMember.findMany({
      where: { userId: user.id, active: true, account: { active: true } },
      select: {
        account: {
          select: {
            id: true,
            name: true,
            cases: {
              where: { active: true },
              select: {
                enquiry: {
                  select: { reference: true, service: true, status: true },
                },
              },
            },
          },
        },
      },
    });
  return (
    <>
      <DashboardHead
        title="Company travel workspace"
        lede="Only explicitly shared company cases appear here. Membership does not grant access to another traveller's requests or authorize accepting quotations."
      />
      {members.map((m) => (
        <section key={m.account.id} className="my-6 rounded-xl border p-5">
          <h2 className="text-2xl">{m.account.name}</h2>
          <ul>
            {m.account.cases.map((c) => (
              <li key={c.enquiry.reference} className="my-3">
                <Link
                  className="underline"
                  href={`/account/enquiries/${c.enquiry.reference}`}
                >
                  {c.enquiry.reference}
                </Link>{" "}
                · {c.enquiry.service} · {c.enquiry.status}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!members.length && (
        <p>
          No company workspace has been assigned. Contact the desk to verify
          your company&apos;s authorized travellers and sharing permissions.
        </p>
      )}
    </>
  );
}
