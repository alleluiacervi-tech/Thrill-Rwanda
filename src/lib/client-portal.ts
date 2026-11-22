import { enqueueWhatsAppStatus } from "@/lib/whatsapp";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { enquiryDateSchema, flightLegSchema } from "@/lib/flight-enquiry-schema";
import { isAirlineCode } from "@/lib/flight-airlines";
import { db } from "@/lib/db";
import {
  canUseEnquiries,
  enquiryScope,
  isFinance,
} from "@/lib/enquiry-workflow";
import { quoteContentHash } from "@/lib/quote-render";
import type { QuoteSnapshot } from "@/lib/quote-rules";
import type { Prisma } from "@/generated/prisma/client";
import { OperationsError } from "@/lib/launch-rules";
import { businessEventMilestones, isBusinessEvent, milestoneActivityKinds } from "@/lib/business-events";
export const clientScope = (userId: string): Prisma.EnquiryWhereInput => ({
  OR: [
    { clientAccess: { some: { userId, active: true } } },
    {
      corporateAccess: {
        some: {
          active: true,
          account: {
            active: true,
            members: { some: { userId, active: true } },
          },
        },
      },
    },
  ],
});
export async function clientCases(userId: string, skip = 0, take = 25) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });
  if (!user?.isActive) throw new OperationsError("Client access denied");
  return db.enquiry.findMany({
    where: clientScope(userId),
    select: { reference: true, service: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    skip: Math.max(0, skip),
    take: Math.min(100, Math.max(1, take)),
  });
}
export async function readClientCase(userId: string, reference: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });
  if (!user?.isActive) return null;
  const e = await db.enquiry.findFirst({
    where: { reference, ...clientScope(userId) },
    select: {
      id: true,
      reference: true,
      service: true,
      status: true,
      version: true,
      createdAt: true,
      details: true,
      activities: {
        where: { kind: { in: milestoneActivityKinds } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        distinct: ["kind"],
        select: { kind: true, changes: true },
      },
      _count: { select: { quoteVersions: true } },
      quoteVersions: {
        orderBy: { number: "desc" },
        take: 1,
        select: {
          id: true,
          number: true,
          snapshot: true,
          contentHash: true,
          expiresAt: true,
          paymentDeadline: true,
        },
      },
      quoteAcceptance: { select: { quoteId: true, acceptedAt: true } },
      clientAccess: {
        where: { userId, active: true },
        select: { canAccept: true },
      },
      supportCases: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          reference: true,
          status: true,
          category: true,
          createdAt: true,
        },
      },
      financialCase: { select: { instructions: true } },
    },
  });
  if (!e) return null;
  for (const q of e.quoteVersions)
    if (quoteContentHash(q.snapshot as QuoteSnapshot) !== q.contentHash)
      throw new OperationsError("Quote integrity check failed");
  const { activities, details, ...visibleCase } = e;
  const itinerary = e.service === "FLIGHT" ? z.object({
    tripType: z.enum(["ONE_WAY", "RETURN", "MULTI_CITY"]),
    additionalLegs: z.array(flightLegSchema).optional(),
    returnDate: enquiryDateSchema.or(z.literal("")).optional(),
    preferredAirline: z.string().optional(),
  }).safeParse(details) : null;
  const firstLeg = itinerary?.success ? flightLegSchema.safeParse(details) : null;
  let requestedFlight = null;
  if (itinerary?.success && firstLeg?.success) {
    const { tripType, additionalLegs, returnDate, preferredAirline } = itinerary.data;
    const first = firstLeg.data;
    const legs = [first];
    if (tripType === "MULTI_CITY") legs.push(...additionalLegs ?? []);
    if (tripType === "RETURN" && returnDate)
      legs.push({ origin: first.destination, destination: first.origin, departureDate: returnDate });
    requestedFlight = { legs, preferredAirline: isAirlineCode(preferredAirline) ? preferredAirline : null };
  }
  return {
    ...visibleCase,
    requestedFlight,
    eventMilestones: isBusinessEvent(details) ? businessEventMilestones(activities) : null,
  };
}
export async function clientQuoteHistory(
  userId: string,
  reference: string,
  skip = 0,
  take = 10,
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });
  if (!user?.isActive) return [];
  const quotes = await db.quoteVersion.findMany({
    where: { enquiry: { reference, ...clientScope(userId) } },
    orderBy: { number: "desc" },
    skip: Math.max(0, skip),
    take: Math.min(25, Math.max(1, take)),
    select: {
      id: true,
      number: true,
      snapshot: true,
      contentHash: true,
      expiresAt: true,
      paymentDeadline: true,
    },
  });
  for (const q of quotes)
    if (quoteContentHash(q.snapshot as QuoteSnapshot) !== q.contentHash)
      throw new OperationsError("Quote integrity check failed");
  return quotes;
}
export async function readClientQuote(
  userId: string,
  reference: string,
  id: string,
) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });
  if (!user?.isActive) return null;
  const quote = await db.quoteVersion.findFirst({
    where: { id, enquiry: { reference, ...clientScope(userId) } },
    select: { number: true, snapshot: true, contentHash: true },
  });
  if (
    quote &&
    quoteContentHash(quote.snapshot as QuoteSnapshot) !== quote.contentHash
  )
    throw new OperationsError("Quote integrity check failed");
  return quote;
}
const accessSchema = z.object({
  reference: z.string().min(4).max(80),
  email: z.email(),
  active: z.boolean(),
  canAccept: z.boolean(),
  version: z.coerce.number().int().min(-1),
  evidence: z.string().trim().min(20).max(2000),
});
export async function linkClient(actorId: string, raw: unknown) {
  const input = accessSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor || !canUseEnquiries(actor) || isFinance(actor))
      throw new OperationsError("Client access administration denied");
    const enquiry = await tx.enquiry.findFirst({
      where: { reference: input.reference, ...enquiryScope(actor) },
    });
    if (
      !enquiry ||
      (actor.role !== "ADMIN" &&
        (actor.staffRole !== "SALES" || enquiry.ownerId !== actorId))
    )
      throw new OperationsError(
        "Only administrators or assigned sales may verify client access",
      );
    const user = await tx.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });
    if (!user?.isActive)
      throw new OperationsError(
        "Choose an existing active account after verifying its owner and consent. Email matching alone is not verification",
      );
    const old = await tx.clientCaseAccess.findUnique({
      where: { enquiryId_userId: { enquiryId: enquiry.id, userId: user.id } },
    });
    if ((old?.version ?? -1) !== input.version)
      throw new OperationsError("Access changed. Reload before saving");
    const data = { active: input.active, canAccept: input.canAccept };
    if (old) {
      const changed = await tx.clientCaseAccess.updateMany({
        where: { id: old.id, version: input.version },
        data: { ...data, version: { increment: 1 } },
      });
      if (!changed.count) throw new OperationsError("Access changed");
    } else
      await tx.clientCaseAccess.create({
        data: { enquiryId: enquiry.id, userId: user.id, ...data },
      });
    await tx.operationsAudit.create({
      data: {
        actorId,
        entityId: enquiry.id,
        action: "CLIENT_ACCESS",
        evidence: input.evidence,
        changes: {
          userId: user.id,
          before: old ? { active: old.active, canAccept: old.canAccept } : null,
          after: data,
        },
      },
    });
  });
}
export async function acceptClientQuote(userId: string, raw: unknown) {
  const input = z
    .object({
      reference: z.string().min(4).max(80),
      quoteId: z.string().uuid(),
      contentHash: z.string().regex(/^[a-f0-9]{64}$/),
      expectedVersion: z.coerce.number().int().min(0),
      signedName: z.string().trim().min(3).max(120),
      checked: z.literal(true),
    })
    .parse(raw);
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user?.isActive) throw new OperationsError("Client access denied");
    const row = await tx.enquiry.findFirst({
      where: {
        reference: input.reference,
        clientAccess: { some: { userId, active: true, canAccept: true } },
      },
    });
    if (!row) throw new OperationsError("Acceptance access denied");
    await tx.$queryRaw`SELECT id FROM enquiries WHERE id=${row.id}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM client_case_access WHERE enquiry_id=${row.id}::uuid AND user_id=${userId}::uuid FOR UPDATE`;
    const grant = await tx.clientCaseAccess.findUnique({
      where: { enquiryId_userId: { enquiryId: row.id, userId } },
    });
    if (!grant?.active || !grant.canAccept)
      throw new OperationsError("Acceptance access revoked");
    const fresh = await tx.enquiry.findUniqueOrThrow({ where: { id: row.id } });
    const latest = await tx.quoteVersion.findFirst({
      where: { enquiryId: row.id },
      orderBy: { number: "desc" },
    });
    if (
      !latest ||
      latest.id !== input.quoteId ||
      latest.contentHash !== input.contentHash ||
      quoteContentHash(latest.snapshot as QuoteSnapshot) !== latest.contentHash
    )
      throw new OperationsError("This quote is missing, superseded or changed");
    const previous = await tx.quoteAcceptance.findUnique({
      where: { enquiryId: row.id },
    });
    if (previous) {
      if (
        previous.quoteId === latest.id &&
        previous.actorId === userId &&
        previous.customerName === input.signedName &&
        previous.channel === "ACCOUNT"
      )
        return previous.id;
      throw new OperationsError("Acceptance already recorded");
    }
    if (
      fresh.status !== "QUOTE_SENT" ||
      fresh.version !== input.expectedVersion ||
      latest.expiresAt <= new Date() ||
      latest.paymentDeadline <= new Date()
    )
      throw new OperationsError(
        "Quote expired or case changed. Reload before accepting",
      );
    const owner = await tx.user.findUnique({
      where: { id: fresh.ownerId ?? "00000000-0000-0000-0000-000000000000" },
    });
    if (!owner?.isActive || !canUseEnquiries(owner) || isFinance(owner))
      throw new OperationsError(
        "Contact the desk to assign a current owner before accepting",
      );
    const accepted = await tx.quoteAcceptance.create({
      data: {
        enquiryId: row.id,
        quoteId: latest.id,
        customerName: input.signedName,
        channel: "ACCOUNT",
        actorId: userId,
        evidence: `Authenticated account accepted exact content hash ${latest.contentHash}`,
        acceptedAt: new Date(),
      },
    });
    await tx.enquiry.update({
      where: { id: row.id },
      data: { status: "AWAITING_PAYMENT", version: { increment: 1 } },
    });
    await tx.enquiryActivity.create({
      data: {
        enquiryId: row.id,
        actorId: userId,
        kind: "QUOTE_ACCEPTED",
        changes: {
          quoteId: latest.id,
          contentHash: latest.contentHash,
          acceptanceId: accepted.id,
          channel: "ACCOUNT",
        },
      },
    });
    await enqueueWhatsAppStatus(tx, row.id);
    return accepted.id;
  });
}
export async function requestClientSupport(userId: string, raw: unknown) {
  const input = z
      .object({
        reference: z.string().min(4).max(80),
        intentKey: z.string().uuid(),
        category: z.enum([
          "CHANGE",
          "CANCELLATION",
          "REFUND",
          "SERVICE",
          "OTHER",
        ]),
        message: z.string().trim().min(10).max(2000),
      })
      .parse(raw),
    inputHash = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user?.isActive) throw new OperationsError("Client access denied");
    const e = await tx.enquiry.findFirst({
      where: { reference: input.reference, ...clientScope(userId) },
    });
    if (!e) throw new OperationsError("Case unavailable");
    const previous = await tx.supportActivity.findUnique({
      where: { intentKey: input.intentKey },
      include: { supportCase: { select: { reference: true } } },
    });
    if (previous) {
      if (previous.actorId !== userId || previous.inputHash !== inputHash)
        throw new OperationsError("Request key already used");
      return previous.supportCase.reference;
    }
    const owner = await tx.user.findUnique({
      where: { id: e.ownerId ?? "00000000-0000-0000-0000-000000000000" },
    });
    if (!owner?.isActive || !canUseEnquiries(owner) || isFinance(owner))
      throw new OperationsError("Contact the desk to arrange a support owner");
    const c = await tx.supportCase.create({
      data: {
        reference: `SUP-${randomUUID().slice(0, 12).toUpperCase()}`,
        enquiryId: e.id,
        ownerId: owner.id,
        category: input.category,
        summary: input.message,
        nextActionAt: new Date(Date.now() + 86400000),
      },
    });
    await tx.supportActivity.create({
      data: {
        caseId: c.id,
        actorId: userId,
        intentKey: input.intentKey,
        inputHash,
        changes: { source: "CLIENT_ACCOUNT", category: input.category },
      },
    });
    return c.reference;
  });
}
const corporateSchema = z.object({
  kind: z.enum(["ACCOUNT", "MEMBER", "CASE"]),
  id: z.string().uuid(),
  version: z.coerce.number().int().min(-1),
  name: z.string().trim().max(200).default(""),
  email: z.string().trim().max(254).default(""),
  reference: z.string().trim().max(80).default(""),
  active: z.boolean(),
  evidence: z.string().trim().min(20).max(2000),
});
export async function saveCorporateAccess(actorId: string, raw: unknown) {
  const input = corporateSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor?.isActive || actor.role !== "ADMIN")
      throw new OperationsError("Administrator access required");
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext('thrill-corporate-access'))`;
    let entityId = input.id;
    if (input.kind === "ACCOUNT") {
      if (input.name.length < 3)
        throw new OperationsError("Record the company name");
      const old = await tx.corporateAccount.findUnique({
        where: { id: input.id },
      });
      if ((old?.version ?? -1) !== input.version)
        throw new OperationsError("Account changed");
      await tx.corporateAccount.upsert({
        where: { id: input.id },
        create: { id: input.id, name: input.name, active: input.active },
        update: {
          name: input.name,
          active: input.active,
          version: { increment: 1 },
        },
      });
    } else {
      const account = await tx.corporateAccount.findUnique({
        where: { id: input.id },
      });
      if (!account) throw new OperationsError("Company unavailable");
      if (input.kind === "MEMBER") {
        const user = await tx.user.findUnique({
          where: { email: input.email.toLowerCase() },
        });
        if (!user?.isActive)
          throw new OperationsError(
            "Choose an existing verified-identity active account",
          );
        const old = await tx.corporateMember.findUnique({
          where: {
            accountId_userId: { accountId: account.id, userId: user.id },
          },
        });
        if ((old?.version ?? -1) !== input.version)
          throw new OperationsError("Membership changed");
        const saved = await tx.corporateMember.upsert({
          where: {
            accountId_userId: { accountId: account.id, userId: user.id },
          },
          create: {
            accountId: account.id,
            userId: user.id,
            active: input.active,
          },
          update: { active: input.active, version: { increment: 1 } },
        });
        entityId = saved.id;
      } else {
        const e = await tx.enquiry.findUnique({
          where: { reference: input.reference },
        });
        if (!e) throw new OperationsError("Enquiry unavailable");
        const old = await tx.corporateCaseAccess.findUnique({
          where: {
            accountId_enquiryId: { accountId: account.id, enquiryId: e.id },
          },
        });
        if ((old?.version ?? -1) !== input.version)
          throw new OperationsError("Case sharing changed");
        const saved = await tx.corporateCaseAccess.upsert({
          where: {
            accountId_enquiryId: { accountId: account.id, enquiryId: e.id },
          },
          create: {
            accountId: account.id,
            enquiryId: e.id,
            active: input.active,
          },
          update: { active: input.active, version: { increment: 1 } },
        });
        entityId = saved.id;
      }
    }
    await tx.operationsAudit.create({
      data: {
        actorId,
        entityId,
        action: `CORPORATE_${input.kind}`,
        evidence: input.evidence,
        changes: { accountId: input.id, active: input.active },
      },
    });
  });
}
