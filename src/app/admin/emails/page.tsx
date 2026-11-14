import Link from "next/link";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { EmailTemplateForm } from "@/components/dashboard/email-template-form";
import { db } from "@/lib/db";
import { emailSamples } from "@/lib/email/samples";
import { PLACEHOLDERS, TEMPLATES, sampleValues } from "@/lib/email/templates";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Email templates",
  robots: { index: false, follow: false },
};

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; view?: string }>;
}) {
  await requireAdmin("/admin/emails");
  const { t, view } = await searchParams;

  // Two jobs on one page: change the words, or check how an email looks.
  const mode = view === "design" ? "design" : "wording";

  const saved = await db.emailTemplate.findMany({ select: { key: true } });
  const edited = new Set(saved.map((s) => s.key));

  const template = TEMPLATES.find((x) => x.key === t) ?? TEMPLATES[0];
  const current = edited.has(template.key)
    ? await db.emailTemplate.findUnique({ where: { key: template.key } })
    : null;

  const design = emailSamples.find((s) => s.id === t) ?? emailSamples[0];
  const samples = sampleValues();

  const tabCls = (on: boolean) =>
    cn(
      "rounded-[calc(var(--radius-inset)-2px)] px-3 py-1.5 text-2xs font-semibold",
      on ? "bg-forest-800 text-bone-50" : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
    );

  return (
    <>
      <DashboardHead
        title="Email templates"
        lede="Change what customer emails say. Details in {braces} are filled in from the booking, so the facts stay right whatever you write."
        action={
          <div className="flex rounded-[var(--radius-inset)] border border-[var(--line-strong)] p-0.5">
            <Link href="/admin/emails" className={tabCls(mode === "wording")}>
              Wording
            </Link>
            <Link href="/admin/emails?view=design" className={tabCls(mode === "design")}>
              Design preview
            </Link>
          </div>
        }
      />

      {mode === "wording" ? (
        <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
          <nav aria-label="Emails" className="flex flex-col gap-1">
            {TEMPLATES.map((x) => {
              const active = x.key === template.key;
              return (
                <Link
                  key={x.key}
                  href={`/admin/emails?t=${x.key}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-[var(--radius-inset)] px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-forest-800 text-bone-50"
                      : "text-[var(--ink)] hover:bg-[var(--paper-sunken)]",
                  )}
                >
                  <span className="block font-medium">{x.label}</span>
                  <span
                    className={cn(
                      "block text-2xs",
                      active ? "text-bone-200" : "text-[var(--ink-faint)]",
                    )}
                  >
                    {edited.has(x.key) ? "Edited" : "Built-in"}
                  </span>
                </Link>
              );
            })}
          </nav>

          <EmailTemplateForm
            key={template.key}
            templateKey={template.key}
            label={template.label}
            when={template.when}
            subject={current?.subject ?? template.subject}
            body={current?.body ?? template.body}
            ctaLabel={current?.ctaLabel ?? template.ctaLabel}
            edited={Boolean(current)}
            // Only the details this email actually carries.
            placeholders={PLACEHOLDERS.filter((p) => template.uses.includes(p.token))}
            samples={samples}
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
          <nav aria-label="Templates" className="flex flex-col gap-1">
            {emailSamples.map((s) => {
              const active = s.id === design.id;
              return (
                <Link
                  key={s.id}
                  href={`/admin/emails?view=design&t=${s.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-[var(--radius-inset)] px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-forest-800 text-bone-50"
                      : "text-[var(--ink)] hover:bg-[var(--paper-sunken)]",
                  )}
                >
                  <span className="block font-medium">{s.label}</span>
                  <span
                    className={cn(
                      "block text-2xs",
                      active ? "text-bone-200" : "text-[var(--ink-muted)]",
                    )}
                  >
                    To: {s.audience}
                  </span>
                </Link>
              );
            })}
          </nav>

          <section className="min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)]">
            <p className="border-b border-[var(--line)] px-4 py-3 text-sm">
              <span className="text-[var(--ink-muted)]">Subject: </span>
              <span className="font-medium">{design.email.subject}</span>
            </p>
            {/* Sandboxed: the preview can't touch the admin page around it. */}
            <iframe
              title={`${design.label} email preview`}
              srcDoc={design.email.html}
              sandbox="allow-popups"
              className="block h-[46rem] w-full bg-white"
            />
          </section>
        </div>
      )}
    </>
  );
}
