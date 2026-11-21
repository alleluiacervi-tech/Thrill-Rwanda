import { quoteContentHash } from "@/lib/quote-render";
import type { QuoteSnapshot } from "@/lib/quote-rules";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { db } from "@/lib/db";
import { canWriteQuotes } from "@/lib/quotes";
import { formatQuoteMoney } from "@/lib/quote-rules";
import {
  QuoteEditor,
  QuoteAcceptanceForm,
  NotificationRetryButton,
} from "@/components/dashboard/quote-editor";
import type { EnquiryActor } from "@/lib/enquiry-workflow";
export async function QuoteWorkspace({
  enquiry,
  actor,
  base,
  businessEvent = false,
}: {
  enquiry: {
    id: string;
    reference: string;
    version: number;
    status: string;
    ownerId: string | null;
    email: string | null;
    replyChannel: string;
  };
  actor: EnquiryActor;
  base: string;
  businessEvent?: boolean;
}) {
  const [quotes, acceptance, jobs] = await Promise.all([
    db.quoteVersion.findMany({
      where: { enquiryId: enquiry.id },
      orderBy: { number: "desc" },
      select: {
        id: true,
        number: true,
        totalMinor: true,
        snapshot: true,
        contentHash: true,
        currency: true,
        issuedAt: true,
        expiresAt: true,
        paymentDeadline: true,
      },
      take: 50,
    }),
    db.quoteAcceptance.findUnique({ where: { enquiryId: enquiry.id } }),
    db.notificationJob.findMany({
      where: { enquiryId: enquiry.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        channel: true,
        status: true,
        attempts: true,
        lastError: true,
        sentAt: true,
        firstAttemptAt: true,
        deliveries: {
          orderBy: { startedAt: "desc" },
          take: 5,
          select: {
            id: true,
            number: true,
            status: true,
            errorCode: true,
            startedAt: true,
          },
        },
      },
      take: 30,
    }),
  ]);
  const now = new Date();
  const writable = canWriteQuotes(actor, enquiry.ownerId);
  const latest = quotes[0];
  return (
    <section className="mt-8">
      <h2 className="text-2xl">Written quotations</h2>
      <p>
        Issued versions are fixed customer-facing documents. Revise by issuing
        another version; only the latest unexpired version can be accepted. No
        payment or booking is created here.
      </p>
      <ul className="mt-4 space-y-3">
        {quotes.map((q, index) => (
          <li key={q.id} className="rounded-xl border border-[var(--line)] p-4">
            <Link
              className="underline"
              href={`${base}/${enquiry.reference}/quotes/${q.id}`}
            >
              Quotation v{q.number} —{" "}
              {formatQuoteMoney(q.totalMinor, q.currency)}
            </Link>
            <p>
              {index ? "Superseded" : "Latest version"} ·{" "}
              {q.expiresAt <= new Date()
                ? "Expired"
                : `Valid until ${q.expiresAt.toLocaleString("en-GB", { timeZone: "Africa/Kigali" })} Kigali`}
              {acceptance?.quoteId === q.id ? " · Acceptance recorded" : ""}
            </p>
          </li>
        ))}
      </ul>
      {!quotes.length && (
        <p className="mt-3">No written quote versions issued yet.</p>
      )}
      {writable &&
        !acceptance &&
        ["CONTACTED", "NEEDS_INFORMATION", "QUOTE_SENT"].includes(
          enquiry.status,
        ) && (
          <QuoteEditor
            key={enquiry.version}
            reference={enquiry.reference}
            enquiryVersion={enquiry.version}
            intentKey={randomUUID()}
            businessEvent={businessEvent}
            seed={
              latest &&
              quoteContentHash(latest.snapshot as QuoteSnapshot) ===
                latest.contentHash
                ? (latest.snapshot as QuoteSnapshot)
                : undefined
            }
            emailAllowed={!!enquiry.email && enquiry.replyChannel === "EMAIL"}
          />
        )}
      {!enquiry.ownerId && (
        <p className="mt-3">Assign an owner before issuing quotes.</p>
      )}
      {writable &&
        !acceptance &&
        latest &&
        enquiry.status === "QUOTE_SENT" &&
        latest.expiresAt > new Date() &&
        latest.paymentDeadline > new Date() && (
          <QuoteAcceptanceForm
            key={`accept-${enquiry.version}`}
            reference={enquiry.reference}
            quoteId={latest.id}
            enquiryVersion={enquiry.version}
            number={latest.number}
          />
        )}
      {acceptance && (
        <p className="mt-4">
          Acceptance recorded for {acceptance.customerName} through{" "}
          {acceptance.channel} at{" "}
          {acceptance.acceptedAt.toLocaleString("en-GB", {
            timeZone: "Africa/Kigali",
          })}{" "}
          Kigali. Payment remains a separate reconciliation step.
        </p>
      )}
      <h3 className="mt-7 text-xl">Notification delivery</h3>
      <p>
        Queued is not sent. Email requires approved configuration and a running
        notification worker. In-app alerts use the same durable queue. Latest 30
        jobs and 5 attempts per job are shown; sent email means provider
        acceptance, not inbox/read confirmation.
      </p>
      <ul className="mt-4 space-y-3">
        {jobs.map((job) => (
          <li
            key={job.id}
            className="rounded-xl border border-[var(--line)] p-4"
          >
            <p>
              {job.kind} · {job.channel} · {job.status} · {job.attempts}{" "}
              attempt(s){job.lastError ? ` · ${job.lastError}` : ""}
            </p>
            {job.sentAt && (
              <p>
                Sent{" "}
                {job.sentAt.toLocaleString("en-GB", {
                  timeZone: "Africa/Kigali",
                })}{" "}
                Kigali
              </p>
            )}
            <ul>
              {job.deliveries.map((attempt) => (
                <li key={attempt.id} className="text-sm">
                  Attempt {attempt.number}: {attempt.status}
                  {attempt.errorCode ? ` (${attempt.errorCode})` : ""}
                </li>
              ))}
            </ul>
            {(actor.role === "ADMIN" ||
              (["SALES", "OPERATIONS"].includes(actor.staffRole ?? "") &&
                enquiry.ownerId === actor.id)) &&
              ["FAILED", "BLOCKED"].includes(job.status) &&
              job.attempts < 5 &&
              job.lastError !== "DELIVERY_REVIEW_REQUIRED" &&
              (!job.firstAttemptAt ||
                now.getTime() - job.firstAttemptAt.getTime() <
                  23 * 3600000) && <NotificationRetryButton jobId={job.id} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
