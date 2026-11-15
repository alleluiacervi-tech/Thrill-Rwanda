import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireEnquiryStaff } from "@/lib/enquiry-access";
import { OperationsForm } from "@/components/dashboard/operations-form";
import { enquiryScope } from "@/lib/enquiry-workflow";
export async function SupplierReviews() {
  const actor = await requireEnquiryStaff();
  if (actor.role !== "ADMIN" && actor.staffRole !== "OPERATIONS") return null;
  const reviews = await db.supplierReview.findMany({
    where: { enquiry: enquiryScope(actor) },
    include: {
      supplier: { select: { name: true } },
      enquiry: { select: { reference: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const suppliers = await db.supplier.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const newReviewIntent = randomUUID();
  return (
    <section className="mt-10">
      <h2 className="text-2xl">Supplier performance and follow-up</h2>
      <p>
        Case-linked, evidenced reviews are internal operational records. Scores
        do not establish supplier certification or automatically publish
        customer claims.
      </p>
      <OperationsForm
        key={newReviewIntent}
        title="Record a completed review or follow-up"
        hidden={{ command: "SUPPLIER_REVIEW", intentKey: newReviewIntent }}
        fields={[
          {
            name: "reference",
            label: "Own enquiry with this supplier commitment",
            required: true,
          },
          {
            name: "supplierId",
            label: "Supplier",
            options: suppliers.map((s) => ({ value: s.id, label: s.name })),
            required: true,
          },
          {
            name: "score",
            label: "Operational score (1–5)",
            type: "number",
            required: true,
          },
          {
            name: "outcome",
            label: "Observed outcome",
            options: [
              "DELIVERED",
              "DELAY",
              "CANCELLED",
              "ISSUE_RESOLVED",
              "FOLLOW_UP",
            ].map((value) => ({ value, label: value })),
          },
          {
            name: "action",
            label: "Agreed corrective action or next step",
            type: "textarea",
            required: true,
          },
          {
            name: "evidence",
            label: "Observed evidence and review authority",
            type: "textarea",
            required: true,
          },
          {
            name: "reviewAt",
            label: "Next review time (Kigali)",
            type: "datetime-local",
            required: true,
          },
        ]}
      />
      <ul>
        {reviews.map((r) => (
          <li key={r.id} className="my-4 rounded border p-4">
            <strong>
              {r.supplier.name} · {r.score}/5 · {r.outcome}
            </strong>
            <p>
              {r.enquiry.reference} · next review{" "}
              {r.reviewAt.toLocaleString("en-GB", {
                timeZone: "Africa/Kigali",
              })}
            </p>
            <p>{r.action}</p>
            <p>{r.evidence}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
