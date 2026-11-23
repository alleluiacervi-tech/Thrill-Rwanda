import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { CollectionAttempt, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { lockFinance } from "@/lib/finance-registry";
import { canFinance } from "@/lib/finance-rules";
import { quoteContentHash } from "@/lib/quote-render";
import type { QuoteSnapshot } from "@/lib/quote-rules";
import { getSiteSettings, paysOnline } from "@/lib/settings";
import { depositMinor, quotedDepositPercent } from "@/lib/deposit";
import { paymentOrigin } from "./urubuto";
import { configuredGateways } from "./registry";
import { routedPaymentMethods, routeForMethod } from "./routing";
import { CollectionError, COLLECTION_METHODS, invoiceCharge, OPEN_COLLECTIONS, payerPhone, type CollectionMethod } from "./rules";

const invoiceInclude = {
  booking: { include: { customer: { select: { fullName: true } } } },
  financialCase: { include: { enquiry: { select: { reference: true, status: true, name: true, service: true } } } },
  attempts: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.PaymentInvoiceInclude;
type Invoice = Prisma.PaymentInvoiceGetPayload<{ include: typeof invoiceInclude }>;
type Reader = Pick<Prisma.TransactionClient, "payment" | "financialEntry">;
export type CollectionAccess = { bookingReference: string; customerId: string } | { token: string };
export type NewPayment = { method: CollectionMethod; phone: string; email: string; expectedMinor: number };

export const quotePaymentStatuses = ["AWAITING_PAYMENT", "PARTNER_PROCESSING", "CONFIRMED"];
export const bookingPaymentStatuses = ["PENDING", "AWAITING_PAYMENT", "CONFIRMED"] as const;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const invoiceNumber = () => `TR-INV-${randomUUID().toUpperCase()}`;
const nextMinute = () => new Date(Date.now() + 60_000);

export async function lockBooking(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${id}::uuid FOR UPDATE`;
}

export async function assertNoUnresolvedBookingPayment(tx: Prisma.TransactionClient, bookingId: string) {
  await lockBooking(tx, bookingId);
  if (
    await tx.collectionAttempt.count({ where: { invoice: { bookingId }, status: { in: OPEN_COLLECTIONS } } }) ||
    await tx.payment.count({ where: { bookingId, gateway: "PESAPAL", status: { in: ["INITIATED", "PENDING"] } } })
  ) throw new CollectionError("A payment is still being checked. Contact the desk before changing this booking.");
}

function currentLink(token: string) {
  if (!tokenPattern.test(token)) throw new CollectionError("This payment link is unavailable.");
  return { tokenHash: digest(token), expiresAt: { gt: new Date() }, revokedAt: null };
}

async function quoteInvoice(tx: Prisma.TransactionClient, actorId: string, reference: string, deposit?: number) {
  await lockFinance(tx);
  const actor = await tx.user.findUnique({ where: { id: actorId } });
  if (!actor || !canFinance(actor)) throw new CollectionError("Finance access is required.");
  const row = await tx.enquiry.findUnique({ where: { reference } });
  if (!row) throw new CollectionError("Enquiry unavailable.");
  await tx.$queryRaw`SELECT id FROM enquiries WHERE id = ${row.id}::uuid FOR UPDATE`;
  const fresh = await tx.enquiry.findUniqueOrThrow({ where: { id: row.id } });
  const accepted = await tx.quoteAcceptance.findUnique({ where: { enquiryId: row.id }, include: { quote: true } });
  if (!accepted || !quotePaymentStatuses.includes(fresh.status) || accepted.quote.paymentDeadline <= new Date()) {
    throw new CollectionError("A current accepted quotation is required.");
  }
  const snapshot = accepted.quote.snapshot as QuoteSnapshot;
  if (quoteContentHash(snapshot) !== accepted.quote.contentHash || snapshot.totalMinor !== accepted.quote.totalMinor || snapshot.currency !== accepted.quote.currency) {
    throw new CollectionError("Quotation integrity verification failed.");
  }
  const total = accepted.quote.totalMinor;
  if (deposit !== undefined && (!Number.isSafeInteger(deposit) || deposit < 1 || deposit > total)) {
    throw new CollectionError("The deposit must be between one minor unit and the quote total.");
  }
  const sum = (kind: string) => snapshot.items.filter((line) => line.kind === kind).reduce((value, line) => value + line.totalMinor, 0);
  const data = await tx.financialCase.upsert({
    where: { enquiryId: row.id },
    update: {},
    create: {
      enquiryId: row.id,
      quoteId: accepted.quoteId,
      currency: accepted.quote.currency,
      customerChargeMinor: total,
      requiredFundingMinor: total,
      serviceFeeMinor: sum("SERVICE_FEE"),
      taxReserveMinor: sum("TAX") + sum("OTHER"),
    },
  });
  if (data.quoteId !== accepted.quoteId || data.currency !== accepted.quote.currency || data.customerChargeMinor !== total) {
    throw new CollectionError("The financial case does not match the accepted quotation.");
  }
  const existing = await tx.paymentInvoice.findUnique({ where: { caseId: data.id } });
  if (existing) {
    if (deposit !== undefined && existing.depositMinor !== deposit) throw new CollectionError("This invoice already has a fixed payment schedule. Leave the deposit blank to rotate its link.");
    return existing;
  }
  return tx.paymentInvoice.create({
    data: { number: invoiceNumber(), caseId: data.id, currency: data.currency, totalMinor: total, depositMinor: deposit ?? total, dueAt: accepted.quote.paymentDeadline },
  });
}

export async function issuePaymentLink(actorId: string, reference: string, days: number, deposit?: number) {
  const origin = paymentOrigin();
  if (!origin) throw new CollectionError("Configure an HTTPS payment origin first.");
  if (!Number.isInteger(days) || days < 1 || days > 14) throw new CollectionError("Choose a link expiry between 1 and 14 days.");
  const token = randomBytes(32).toString("base64url");
  await db.$transaction(async (tx) => {
    const invoice = await quoteInvoice(tx, actorId, reference, deposit);
    const times = { createdAt: new Date(), revokedAt: null, expiresAt: new Date(Math.min(Date.now() + days * 86_400_000, invoice.dueAt!.getTime())) };
    const values = { tokenHash: digest(token), createdBy: actorId, ...times };
    await tx.paymentLink.upsert({ where: { invoiceId: invoice.id }, update: values, create: { invoiceId: invoice.id, ...values } });
  });
  return `${origin}/pay/${token}`;
}

export async function revokePaymentLink(actorId: string, reference: string) {
  await db.$transaction(async (tx) => {
    await lockFinance(tx);
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor || !canFinance(actor)) throw new CollectionError("Finance access is required.");
    const result = await tx.paymentLink.updateMany({
      where: { revokedAt: null, invoice: { financialCase: { enquiry: { reference } } } },
      data: { revokedAt: new Date() },
    });
    if (!result.count) throw new CollectionError("There is no active payment link for this enquiry.");
  });
}

async function invoiceBalance(invoice: Invoice, reader: Reader) {
  if (invoice.bookingId) {
    const total = await reader.payment.aggregate({
      where: { bookingId: invoice.bookingId, status: "SUCCEEDED", currency: invoice.currency },
      _sum: { amountMinor: true },
    });
    return total._sum.amountMinor ?? 0;
  }
  const total = await reader.financialEntry.aggregate({
    where: { caseId: invoice.caseId!, kind: "RECEIPT" },
    _sum: { amountMinor: true },
  });
  const unposted = invoice.attempts.filter((attempt) => attempt.status === "SUCCESSFUL" && !attempt.settledAt)
    .reduce((value, attempt) => value + attempt.amountMinor, 0);
  return (total._sum.amountMinor ?? 0) + unposted;
}

function openAttempt(invoice: Invoice) {
  return invoice.attempts.find((attempt) => OPEN_COLLECTIONS.includes(attempt.status));
}

function usable(invoice: Invoice) {
  const booking = invoice.booking;
  if (booking) {
    const terms = (booking.details as { terms?: { acceptedAt?: unknown } } | null)?.terms;
    return Boolean(terms?.acceptedAt) && (bookingPaymentStatuses as readonly string[]).includes(booking.status) &&
      booking.totalMinor === invoice.totalMinor && booking.currency === invoice.currency &&
      ["TOUR", "VEHICLE"].includes(booking.serviceType) && booking.startDate.getTime() + 86_400_000 > Date.now();
  }
  return !!invoice.financialCase && quotePaymentStatuses.includes(invoice.financialCase.enquiry.status) &&
    !!invoice.dueAt && invoice.dueAt > new Date();
}

export async function bookingPaymentAvailability(booking: {
  currency: string; totalMinor: number; serviceType: string; details: unknown;
}, paid: number) {
  if (!["TOUR", "VEHICLE"].includes(booking.serviceType) || !(await paysOnline(booking.serviceType))) return false;
  const deposit = bookingDeposit(booking, (await getSiteSettings()).depositPercent);
  return Boolean((await routedPaymentMethods(booking.currency, invoiceCharge(booking.totalMinor, paid, deposit))).length);
}

function bookingDeposit(booking: { currency: string; totalMinor: number; details: unknown }, fallback: number) {
  const percent = quotedDepositPercent(booking.details, fallback);
  return booking.currency === "RWF" ? Math.ceil(booking.totalMinor * percent / 100) : depositMinor(booking.totalMinor, percent);
}

async function readInvoice(access: CollectionAccess) {
  if ("token" in access) {
    const link = await db.paymentLink.findUnique({ where: currentLink(access.token), include: { invoice: { include: invoiceInclude } } });
    return link?.invoice ?? null;
  }
  return db.paymentInvoice.findFirst({
    where: { booking: { reference: access.bookingReference, customerId: access.customerId } },
    include: invoiceInclude,
  });
}

export async function prepareBookingInvoice(reference: string, customerId: string) {
  const settings = await getSiteSettings();
  const initial = await db.booking.findFirst({ where: { reference, customerId } });
  if (!initial) return false;
  const permitted = await paysOnline(initial.serviceType);
  return db.$transaction(async (tx) => {
    await lockBooking(tx, initial.id);
    const row = await tx.booking.findFirst({ where: { id: initial.id, customerId } });
    const terms = (row?.details as { terms?: { acceptedAt?: unknown } } | null)?.terms;
    if (!row || !terms?.acceptedAt) return false;
    if (await tx.paymentInvoice.count({ where: { bookingId: row.id } })) return true;
    if (!permitted || !["TOUR", "VEHICLE"].includes(row.serviceType) || !(bookingPaymentStatuses as readonly string[]).includes(row.status) || row.startDate.getTime() + 86_400_000 <= Date.now()) return false;
    const paid = await tx.payment.aggregate({
      where: { bookingId: row.id, status: "SUCCEEDED", currency: row.currency }, _sum: { amountMinor: true },
    });
    const depositMinor = bookingDeposit(row, settings.depositPercent);
    if (!(await routedPaymentMethods(row.currency, invoiceCharge(row.totalMinor, paid._sum.amountMinor ?? 0, depositMinor), tx)).length) return false;
    await tx.paymentInvoice.create({
      data: { bookingId: row.id, number: invoiceNumber(), currency: row.currency, totalMinor: row.totalMinor, depositMinor },
    });
    return true;
  });
}

export async function collectionCheckout(access: CollectionAccess) {
  const invoice = await readInvoice(access);
  if (!invoice) return null;
  const paid = await invoiceBalance(invoice, db);
  const attempt = openAttempt(invoice) ?? invoice.attempts[0];
  const amount = invoiceCharge(invoice.totalMinor, paid, invoice.depositMinor);
  const legacyOpen = invoice.bookingId && await db.payment.count({
    where: { bookingId: invoice.bookingId, gateway: "PESAPAL", status: { in: ["INITIATED", "PENDING"] } },
  });
  const pendingBank = invoice.caseId && await db.receiptAllocation.count({
    where: { caseId: invoice.caseId, status: "ACTIVE", receipt: { status: "PENDING" } },
  });
  const methods = !legacyOpen && !pendingBank && !invoice.financialCase?.instructions && usable(invoice) && !openAttempt(invoice) &&
    (!invoice.booking || await paysOnline(invoice.booking.serviceType))
    ? await routedPaymentMethods(invoice.currency, amount)
    : [];
  const bank = !openAttempt(invoice) && !pendingBank && usable(invoice) && amount > 0
    ? await verifiedBankInstructions(invoice) : null;
  return {
    invoiceNumber: invoice.number,
    testing: process.env.APP_ENV !== "production",
    reference: invoice.booking?.reference ?? invoice.financialCase!.enquiry.reference,
    service: invoice.booking?.serviceType ?? invoice.financialCase!.enquiry.service,
    dueAt: invoice.dueAt,
    date: invoice.createdAt,
    totalMinor: invoice.totalMinor,
    currency: invoice.currency,
    paidMinor: paid,
    amountMinor: amount,
    methods,
    bank,
    existingPaymentUnderReview: !!legacyOpen || !!pendingBank,
    attempt: attempt ? {
      reference: attempt.merchantReference, method: attempt.method, status: attempt.status,
      expiresAt: attempt.expiresAt, amountMinor: attempt.amountMinor,
      hostedUrl: attempt.status === "REQUIRES_ACTION" && attempt.expiresAt > new Date() ? attempt.hostedUrl : null,
    } : null,
    receipts: invoice.attempts.filter((item) => item.status === "SUCCESSFUL").map((item) => ({
      reference: item.merchantReference, amountMinor: item.amountMinor, verifiedAt: item.verifiedAt, method: item.method,
    })),
  };
}

export async function collectionDocument(access: CollectionAccess, reference?: string) {
  const invoice = await readInvoice(access);
  if (!invoice) return null;
  const attempt = reference
    ? invoice.attempts.find((item) => item.status === "SUCCESSFUL" && item.merchantReference === reference) : null;
  if (reference && !attempt) return null;
  const quote = invoice.financialCase
    ? await db.quoteVersion.findUnique({ where: { id: invoice.financialCase.quoteId }, select: { snapshot: true, contentHash: true } })
    : null;
  const snapshot = quote?.snapshot as QuoteSnapshot | undefined;
  const accepted = snapshot && quote && quoteContentHash(snapshot) === quote.contentHash ? snapshot : undefined;
  return {
    number: invoice.number,
    reference: invoice.booking?.reference ?? invoice.financialCase!.enquiry.reference,
    customerName: invoice.booking?.customer.fullName ?? invoice.financialCase!.enquiry.name,
    description: accepted?.serviceDescription ?? invoice.booking?.serviceType ?? invoice.financialCase!.enquiry.service,
    taxes: accepted?.taxTreatment ?? "See the booking or accepted quotation for applicable taxes.",
    issuedAt: invoice.createdAt,
    currency: invoice.currency,
    totalMinor: invoice.totalMinor,
    paidMinor: await invoiceBalance(invoice, db),
    attempt,
  };
}

async function verifiedBankInstructions(invoice: Invoice) {
  const code = invoice.financialCase?.instructions.match(/^\[([^\]]+)\]/)?.[1];
  if (!code) return null;
  return db.settlementAccount.findFirst({
    where: { code, active: true, currency: invoice.currency, method: "BANK_TRANSFER" },
    select: { name: true, instructions: true },
  });
}

export async function beginCollection(access: CollectionAccess, input: NewPayment) {
  if (!configuredGateways().some((gateway) => gateway.enabled && gateway.origin)) throw new CollectionError("Online payments are currently unavailable.");
  const phone = payerPhone(input.phone, input.method);
  if (!phone) throw new CollectionError("Enter a valid phone number for the selected payment method.");
  const initial = await readInvoice(access);
  if (!initial) throw new CollectionError("This invoice is unavailable.");
  if (initial.booking && !(await paysOnline(initial.booking.serviceType))) throw new CollectionError("Online payments are disabled for this service.");
  const prepared = await db.$transaction(async (tx) => {
    if (initial.bookingId) await lockBooking(tx, initial.bookingId);
    else await lockFinance(tx);
    if ("token" in access && !(await tx.paymentLink.count({ where: { ...currentLink(access.token), invoiceId: initial.id } }))) {
      throw new CollectionError("This link has expired or been replaced.");
    }
    const invoice = await tx.paymentInvoice.findUniqueOrThrow({ where: { id: initial.id }, include: invoiceInclude });
    const active = openAttempt(invoice);
    if (active) return null;
    if (invoice.attempts.filter((attempt) => attempt.createdAt.getTime() > Date.now() - 15 * 60_000).length >= 5) {
      throw new CollectionError("Several payment attempts were made recently. Wait before trying again or contact the desk.");
    }
    if (!usable(invoice)) throw new CollectionError("This invoice is closed. Contact the desk for current payment instructions.");
    if (invoice.financialCase?.instructions) throw new CollectionError("The desk has already issued off-site payment instructions for this invoice.");
    if (invoice.bookingId && await tx.payment.count({
      where: { bookingId: invoice.bookingId, gateway: "PESAPAL", status: { in: ["INITIATED", "PENDING"] } },
    })) throw new CollectionError("A previous booking payment is under review.");
    if (invoice.caseId && await tx.receiptAllocation.count({
      where: { caseId: invoice.caseId, status: "ACTIVE", receipt: { status: "PENDING" } },
    })) throw new CollectionError("Finance is checking a bank transfer for this invoice.");
    const paid = await invoiceBalance(invoice, tx);
    const amountMinor = invoiceCharge(invoice.totalMinor, paid, invoice.depositMinor);
    if (amountMinor !== input.expectedMinor) throw new CollectionError("The amount due changed. Refresh and review the new total.");
    const gateway = await routeForMethod(input.method, invoice.currency, amountMinor, tx);
    if (!gateway?.origin) throw new CollectionError("This method is unavailable for the amount or currency.");
    const customer = invoice.booking?.customer ?? invoice.financialCase!.enquiry;
    const attempt = await tx.collectionAttempt.create({
      data: {
        invoiceId: invoice.id, environment: gateway.provider.environment, provider: gateway.provider.id,
        merchantCode: gateway.provider.merchantCode, serviceCode: gateway.provider.serviceCode,
        merchantReference: randomUUID(), amountMinor, currency: invoice.currency, method: input.method,
        status: "CREATED", nextCheckAt: nextMinute(), expiresAt: new Date(Date.now() + (input.method === "CARD" ? 60 : 15) * 60_000),
      },
    });
    return { attempt, gateway, name: "fullName" in customer ? customer.fullName : customer.name };
  });
  if (!prepared) return;
  const { attempt, gateway, name } = prepared;
  try {
    const opened = await gateway.provider.createPayment({
      ...providerTarget(attempt), name, email: input.email, phone,
      returnUrl: `${gateway.origin}/payments/status/${attempt.merchantReference}`,
    });
    await db.collectionAttempt.updateMany({
      where: { id: attempt.id, status: "CREATED" },
      data: { status: "REQUIRES_ACTION", providerReference: opened.providerReference, hostedUrl: opened.hostedUrl },
    });
  } catch {
    await db.collectionAttempt.updateMany({
      where: { id: attempt.id, status: "CREATED" },
      data: { status: "PENDING" },
    });
  }
}

export function providerTarget(attempt: CollectionAttempt) {
  if (!COLLECTION_METHODS.includes(attempt.method as CollectionMethod)) throw new CollectionError("Unsupported payment method.");
  return { reference: attempt.merchantReference, amountMinor: attempt.amountMinor, currency: attempt.currency, method: attempt.method as CollectionMethod };
}
