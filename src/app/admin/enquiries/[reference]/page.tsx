import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export default async function EnquiryPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  await requireAdmin("/admin/enquiries");
  const { reference } = await params;
  const enquiry = await db.enquiry.findUnique({ where: { reference } });
  if (!enquiry) notFound();
  const details = enquiry.details as Record<string, string | number | boolean>;
  const fields = [
    "origin",
    "destination",
    "tripType",
    "departureDate",
    "returnDate",
    "flexible",
    "adults",
    "children",
    "infants",
    "cabin",
    "baggage",
    "notes",
  ];
  return (
    <>
      <Link href="/admin/enquiries" className="underline">
        Back to enquiries
      </Link>
      <DashboardHead title="Flight enquiry" lede={enquiry.reference} />
      <p className="mb-6">
        New request · not a confirmed booking. Review and contact the customer
        through their preferred channel. Quotation and workflow tools are
        planned in the next phase.
      </p>
      <dl className="grid gap-4 sm:grid-cols-2">
        {[
          ["Customer", enquiry.name],
          ["Phone / WhatsApp", enquiry.phone],
          ["Email", enquiry.email || "Not supplied"],
          ["Preferred reply", enquiry.replyChannel],
          ["Source", enquiry.source],
          [
            "Received (Kigali)",
            enquiry.createdAt.toLocaleString("en-GB", {
              timeZone: "Africa/Kigali",
            }),
          ],
          ...fields.map((key) => [
            key.replace(/([A-Z])/g, " $1"),
            String(details[key] ?? "Not supplied"),
          ]),
        ].map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 rounded-xl border border-[var(--line)] p-4"
          >
            <dt className="text-sm capitalize text-[var(--ink-muted)]">
              {label}
            </dt>
            <dd className="mt-2 whitespace-pre-wrap break-words">
              {value || "Not supplied"}
            </dd>
          </div>
        ))}
      </dl>
      <section className="mt-8 rounded-xl border border-[var(--line)] p-5">
        <h2 className="text-xl">Consent evidence</h2>
        <p className="mt-3">{enquiry.consentText}</p>
        <p className="mt-2 text-sm">
          Recorded {enquiry.createdAt.toISOString()} · wording{" "}
          {enquiry.consentVersion} · privacy version{" "}
          {enquiry.privacyVersion === 0
            ? "0 (draft privacy notice)"
            : enquiry.privacyVersion}
        </p>
      </section>
    </>
  );
}
