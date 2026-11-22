import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { paginate } from "@/lib/pagination";
import { Pagination } from "@/components/ui/pagination";
import { clientQuoteHistory, readClientCase } from "@/lib/client-portal";
import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { renderQuoteHtml } from "@/lib/quote-render";
import { ClientCaseForm } from "@/components/dashboard/client-case-form";
import type { QuoteSnapshot } from "@/lib/quote-rules";
import { label } from "@/lib/enquiry-workflow";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/account/enquiries"),
    { reference } = await params,
    e = await readClientCase(user.id, reference);
  if (!e) notFound();
  const latest = e.quoteVersions[0],
    query = await searchParams;
  const quotePage = paginate(query, e._count.quoteVersions, 10, "quotes");
  const quoteHistory = await clientQuoteHistory(
    user.id,
    e.reference,
    quotePage.skip,
    quotePage.take,
  );
  return (
    <>
      <DashboardHead
        title={e.eventMilestones ? "Thrill Events & Business" : "Your travel request"}
        lede={`${e.reference} · ${e.status.replaceAll("_", " ")}`}
      />
      <p>
        Requests, acceptance, verified funds and supplier confirmation are
        separate steps. Contact the desk if any details need correction.
      </p>
      {e.eventMilestones && (
        <section className="my-6 rounded-xl border p-5">
          <h2 className="text-xl">Event milestones</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {e.eventMilestones.map(({ milestone, status }) => (
              <div key={milestone}>
                <dt>{label(milestone)}</dt>
                <dd>{label(status)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {e.financialCase?.instructions && (
        <section className="my-6 rounded-xl border p-5">
          <h2 className="text-xl">Approved payment instructions</h2>
          <p className="mt-3 whitespace-pre-wrap">
            {e.financialCase.instructions}
          </p>
        </section>
      )}
      <h2 className="mt-8 text-2xl">Issued quotations</h2>
      {quoteHistory.map((q) => (
        <section key={q.id} className="my-6">
          <h3 className="text-xl">
            Version {q.number}{" "}
            {q.id === e.quoteAcceptance?.quoteId
              ? " · Accepted"
              : q.id !== latest?.id
                ? " · Historical version"
                : ""}
          </h3>
          <a
            href={`/account/enquiries/${e.reference}/quotes/${q.id}/download`}
            className="my-4 inline-block underline"
          >
            Download this written quotation (PDF)
          </a>
          <details open={q.id === latest?.id}>
            <summary>Read quotation and terms</summary>
            <div
              className="overflow-x-auto rounded-xl border bg-white p-4 text-black"
              dangerouslySetInnerHTML={{
                __html: renderQuoteHtml(q.snapshot as QuoteSnapshot)
                  .replace(/^[\s\S]*?<body[^>]*>/, "")
                  .replace(/<\/body>[\s\S]*$/, ""),
              }}
            />
          </details>
        </section>
      ))}
      <Pagination
        page={quotePage}
        pathname={`/account/enquiries/${e.reference}`}
        params={query}
        label="quotation versions"
        param="quotes"
      />
      {!e.quoteAcceptance &&
        latest &&
        e.status === "QUOTE_SENT" &&
        e.clientAccess.some((a) => a.canAccept) &&
        latest.expiresAt > new Date() &&
        latest.paymentDeadline > new Date() && (
          <ClientCaseForm
            key={`${e.version}-accept`}
            accept
            hidden={{
              command: "ACCEPT",
              reference: e.reference,
              quoteId: latest.id,
              contentHash: latest.contentHash,
              expectedVersion: e.version,
            }}
          />
        )}
      {e.quoteAcceptance && (
        <p>
          Acceptance recorded{" "}
          {e.quoteAcceptance.acceptedAt.toLocaleString("en-GB", {
            timeZone: "Africa/Kigali",
          })}{" "}
          Kigali time. This is not ticket or supplier confirmation.
        </p>
      )}
      <h2 className="mt-10 text-2xl">Support for this request</h2>
      <ClientCaseForm
        hidden={{
          command: "SUPPORT",
          reference: e.reference,
          intentKey: randomUUID(),
        }}
      />
      <ul>
        {e.supportCases.map((c) => (
          <li key={c.reference} className="my-3">
            {c.reference} · {c.category} · {c.status.replaceAll("_", " ")}
          </li>
        ))}
      </ul>
      <p className="mt-6">
        <Link href="/support" className="underline">
          Staffed hours and urgent help
        </Link>
      </p>
    </>
  );
}
