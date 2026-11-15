import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  supplierSchema,
  accountSchema,
  FinanceError,
  referenceKey,
  type SupplierInput,
} from "@/lib/finance-rules";
import { followUpDate } from "@/lib/enquiry-workflow";
export async function lockFinance(tx: Prisma.TransactionClient) {
  // A short database lock serializes cross-case allocations and registry changes.
  // No external calls are made while holding it.
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended('thrill-finance-ledger', 0))`;
}
export async function saveSupplier(actorId: string, raw: SupplierInput) {
  const input = supplierSchema.parse(raw);
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return db.$transaction(async (tx) => {
    await lockFinance(tx);
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (
      !actor?.isActive ||
      !(actor.role === "ADMIN" || actor.staffRole === "OPERATIONS")
    )
      throw new FinanceError(
        "Supplier management requires administrator or operations access.",
      );
    const previousIntent = await tx.registryAudit.findUnique({
      where: { intentKey: input.intentKey },
    });
    if (previousIntent) {
      if (
        previousIntent.actorId !== actorId ||
        previousIntent.inputHash !== hash
      )
        throw new FinanceError(
          "This request was already used. Reload the form.",
        );
      return previousIntent.entityId;
    }
    const old = input.id
      ? await tx.supplier.findUnique({ where: { id: input.id } })
      : null;
    if (input.id && !old) throw new FinanceError("Supplier not found.");
    if (
      actor.role !== "ADMIN" &&
      (input.status !== "DRAFT" || (old && old.status !== "DRAFT"))
    )
      throw new FinanceError(
        "Only administrators can approve, suspend or edit an approved supplier.",
      );
    let nextReviewAt: Date | null = null;
    if (input.nextReviewAt) {
      try {
        nextReviewAt = followUpDate(input.nextReviewAt);
      } catch {
        throw new FinanceError("Choose a valid supplier review date/time.");
      }
    }
    const {
      intentKey: _key,
      id: _id,
      version: _version,
      verified: _verified,
      ...values
    } = input;
    void _key;
    void _id;
    void _version;
    void _verified;
    const data = { ...values, nextReviewAt };
    let id: string;
    if (old) {
      const changed = await tx.supplier.updateMany({
        where: { id: old.id, version: input.version },
        data: { ...data, version: { increment: 1 } },
      });
      if (!changed.count)
        throw new FinanceError("Supplier changed. Reload before saving.");
      id = old.id;
    } else id = (await tx.supplier.create({ data })).id;
    await tx.registryAudit.create({
      data: {
        actorId,
        entityId: id,
        intentKey: input.intentKey,
        inputHash: hash,
        action: "SAVE_SUPPLIER",
        changes: {
          before: old ? JSON.parse(JSON.stringify(old)) : null,
          after: JSON.parse(JSON.stringify(data)),
        },
      },
    });
    return id;
  });
}
export async function createSettlementAccount(actorId: string, raw: unknown) {
  const input = accountSchema.parse(raw);
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return db.$transaction(async (tx) => {
    await lockFinance(tx);
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor?.isActive || actor.role !== "ADMIN")
      throw new FinanceError(
        "Only administrators may approve settlement accounts.",
      );
    const previous = await tx.registryAudit.findUnique({
      where: { intentKey: input.intentKey },
    });
    if (previous) {
      if (previous.actorId !== actorId || previous.inputHash !== hash)
        throw new FinanceError("Request already used.");
      return previous.entityId;
    }
    const row = await tx.settlementAccount.create({
      data: {
        code: referenceKey(input.code),
        name: input.name,
        method: input.method,
        currency: input.currency,
        instructions: input.instructions,
        approvalEvidence: input.approvalEvidence,
      },
    });
    await tx.registryAudit.create({
      data: {
        actorId,
        entityId: row.id,
        intentKey: input.intentKey,
        inputHash: hash,
        action: "APPROVE_ACCOUNT",
        changes: { code: row.code, method: row.method, currency: row.currency },
      },
    });
    return row.id;
  });
}
export async function changeAccountStatus(
  actorId: string,
  id: string,
  version: number,
  active: boolean,
  evidence: string,
) {
  if (evidence.trim().length < 10)
    throw new FinanceError(
      "Record approval evidence for this account status change.",
    );
  return db.$transaction(async (tx) => {
    await lockFinance(tx);
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!actor?.isActive || actor.role !== "ADMIN")
      throw new FinanceError(
        "Only administrators may change settlement accounts.",
      );
    const changed = await tx.settlementAccount.updateMany({
      where: { id, version },
      data: { active, version: { increment: 1 } },
    });
    if (!changed.count)
      throw new FinanceError("Account changed. Reload before saving.");
    await tx.registryAudit.create({
      data: {
        actorId,
        entityId: id,
        intentKey: crypto.randomUUID(),
        inputHash: "account-status",
        action: "ACCOUNT_STATUS",
        changes: { active, evidence },
      },
    });
  });
}
