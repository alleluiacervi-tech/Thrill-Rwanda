import { notFound } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { db } from "@/lib/db";
import { PageShell } from "@/components/layout/page-shell";
import { paymentStatusLabel } from "@/lib/collections/rules";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment status", robots: { index: false, follow: false } };

export default async function PaymentStatus({ params }: { params: Promise<{ reference: string }> }) {
  const parsed = z.uuid().safeParse((await params).reference);
  if (!parsed.success) notFound();
  const attempt = await db.collectionAttempt.findUnique({ where: { merchantReference: parsed.data }, select: { status: true } });
  if (!attempt) notFound();
  return <PageShell><section className="mx-auto max-w-xl space-y-4 px-6 py-14">
    {process.env.APP_ENV !== "production" ? <p className="text-sm font-medium text-clay-800">Testing environment</p> : null}
    <h1 className="text-3xl">{paymentStatusLabel[attempt.status] ?? "Payment status"}</h1>
    <p>Open your original Thrill Rwanda checkout or payment link to see the latest verification and receipt.</p>
    <Link className="underline" href="/contact">Contact the travel desk</Link>
  </section></PageShell>;
}
