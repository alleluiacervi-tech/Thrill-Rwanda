import Link from "next/link";
import { FileText } from "lucide-react";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { LegalForm } from "@/components/dashboard/legal-form";
import { db } from "@/lib/db";
import { DEFAULT_AGREEMENT, AGREEMENT_SLUG, AGREEMENT_FIELDS } from "@/lib/agreement";
import { EDITABLE_SLUGS, LEGAL_TITLES, type EditableSlug } from "@/lib/legal";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Legal pages",
  robots: { index: false, follow: false },
};

export default async function AdminLegalPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  await requireAdmin("/admin/legal");

  const { doc } = await searchParams;
  const slug = (EDITABLE_SLUGS as readonly string[]).includes(doc ?? "")
    ? (doc as EditableSlug)
    : "terms";

  const [current, all] = await Promise.all([
    db.legalDocument.findUnique({ where: { slug } }),
    db.legalDocument.findMany({ select: { slug: true, version: true } }),
  ]);
  const published = new Map(all.map((d) => [d.slug, d.version]));

  return (
    <>
      <DashboardHead
        title="Legal pages"
        lede="Paste the company's own terms, privacy and cancellation policies here. Saving replaces the draft on the website immediately; bookings record the version the customer accepted."
      />

      <nav aria-label="Choose a document" className="mb-6 flex flex-wrap gap-2">
        {EDITABLE_SLUGS.map((s) => {
          const active = s === slug;
          return (
            <Link
              key={s}
              href={`/admin/legal?doc=${s}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-2xs font-medium transition-colors",
                active
                  ? "border-forest-800 bg-forest-800 text-bone-50"
                  : "border-[var(--line-strong)] text-[var(--ink-muted)] hover:border-forest-800",
              )}
            >
              <FileText className="size-3.5" />
              {LEGAL_TITLES[s]}
              <span className={active ? "text-bone-200" : "text-[var(--ink-faint)]"}>
                {published.has(s) ? `v${published.get(s)}` : "draft"}
              </span>
            </Link>
          );
        })}
      </nav>

      {slug === AGREEMENT_SLUG ? (
        <p className="mb-6 rounded-[var(--radius-inset)] border border-[var(--line)] bg-[var(--paper-sunken)] p-4 text-2xs leading-relaxed text-[var(--ink-muted)]">
          <strong className="font-semibold text-[var(--ink)]">This one has no public page.</strong>{" "}
          Each customer sees it with their own booking filled in, and signs it before collection.
          Available details:{" "}
          {AGREEMENT_FIELDS.map((f) => f.token).join(", ")}.
        </p>
      ) : null}

      <LegalForm
        key={slug}
        slug={slug}
        title={current?.title ?? LEGAL_TITLES[slug]}
        body={current?.body ?? (slug === AGREEMENT_SLUG ? DEFAULT_AGREEMENT : "")}
        version={current?.version ?? 0}
        publicHref={slug === AGREEMENT_SLUG ? null : `/legal/${slug}`}
        updatedAt={
          current
            ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(
                current.updatedAt,
              )
            : null
        }
      />
    </>
  );
}
