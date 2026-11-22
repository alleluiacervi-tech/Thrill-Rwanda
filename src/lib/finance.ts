import { enqueueWhatsAppStatus } from "@/lib/whatsapp";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { lockFinance } from "@/lib/finance-registry";
import {
  canFinance,
  canOperate,
  commitmentBalance,
  financeCommandSchema,
  financialSummary,
  FinanceError,
  money,
  referenceKey,
  refundBalance,
  type FinanceCommand,
} from "@/lib/finance-rules";
import {
  canUseEnquiries,
  enquiryScope,
  followUpDate,
} from "@/lib/enquiry-workflow";
import { quoteContentHash } from "@/lib/quote-render";
import type { QuoteSnapshot } from "@/lib/quote-rules";
import { OPEN_COLLECTIONS } from "@/lib/collections/rules";

export const financeInclude = {
  entries: true,
  commitments: { include: { supplier: true } },
  refunds: true,
} satisfies Prisma.FinancialCaseInclude;
export async function executeFinanceCommand(
  actorId: string,
  raw: FinanceCommand,
) {
  const input = financeCommandSchema.parse(raw);
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return db.$transaction(
    async (tx) => {
      await lockFinance(tx);
      const actor = await tx.user.findUnique({ where: { id: actorId } });
      if (!actor || !canUseEnquiries(actor))
        throw new FinanceError("Financial workspace access denied.");
      const row = await tx.enquiry.findFirst({
        where: { reference: input.reference, ...enquiryScope(actor) },
      });
      if (!row) throw new FinanceError("Enquiry not found in your workspace.");
      const operational = [
        "CONFIRM_SUPPLIER",
        "CONFIRM_SERVICE",
        "COMPLETE_SERVICE",
        "LINK_BOOKING",
      ].includes(input.action);
      const receiptCapture =
        input.action === "RECORD_RECEIPT" &&
        actor.staffRole === "SALES" &&
        row.ownerId === actor.id;
      if (
        !(operational
          ? canOperate(actor, row.ownerId)
          : canFinance(actor) || receiptCapture)
      )
        throw new FinanceError(
          "Your role cannot perform this financial or fulfilment action.",
        );
      if (input.action === "LINK_BOOKING" && actor.role !== "ADMIN")
        throw new FinanceError(
          "Only administrators can link historical bookings.",
        );
      const previous = await tx.financialOperation.findUnique({
        where: { intentKey: input.intentKey },
      });
      if (previous) {
        if (previous.actorId !== actorId || previous.inputHash !== hash)
          throw new FinanceError(
            "This request was already used with different details. Reload the form.",
          );
        return row.reference;
      }
      await tx.$queryRaw`SELECT id FROM enquiries WHERE id = ${row.id}::uuid FOR UPDATE`;
      const fresh = await tx.enquiry.findUniqueOrThrow({
        where: { id: row.id },
      });
      if (fresh.version !== input.expectedVersion)
        throw new FinanceError(
          "This enquiry changed. Reload before saving financial records.",
        );
      const accepted = await tx.quoteAcceptance.findUnique({
        where: { enquiryId: row.id },
        include: { quote: true },
      });
      if (!accepted)
        throw new FinanceError(
          "A verified accepted quotation is required before financial records can be created.",
        );
      const snapshot = accepted.quote.snapshot as QuoteSnapshot;
      if (quoteContentHash(snapshot) !== accepted.quote.contentHash)
        throw new FinanceError("Accepted quote integrity check failed.");
      if (input.currency !== accepted.quote.currency)
        throw new FinanceError(
          "Use the accepted quotation currency. Currency conversion is not performed here.",
        );
      const quotedFee = snapshot.items
        .filter((i) => i.kind === "SERVICE_FEE")
        .reduce((n, i) => n + i.totalMinor, 0);
      const quotedTax = snapshot.items
        .filter((i) => i.kind === "TAX")
        .reduce((n, i) => n + i.totalMinor, 0);
      const quotedOther = snapshot.items
        .filter((i) => i.kind === "OTHER")
        .reduce((n, i) => n + i.totalMinor, 0);
      const base = await tx.financialCase.upsert({
        where: { enquiryId: row.id },
        update: {},
        create: {
          enquiryId: row.id,
          quoteId: accepted.quoteId,
          currency: input.currency,
          customerChargeMinor: snapshot.totalMinor,
          serviceFeeMinor: quotedFee,
          taxReserveMinor: quotedTax + quotedOther,
          requiredFundingMinor: snapshot.totalMinor,
        },
      });
      if (base.quoteId !== accepted.quoteId)
        throw new FinanceError(
          "Financial case does not match the accepted quotation.",
        );
      const data = await tx.financialCase.findUniqueOrThrow({
        where: { id: base.id },
        include: financeInclude,
      });
      if (["INSTRUCTIONS", "RECORD_RECEIPT", "ALLOCATE_RECEIPT"].includes(input.action) &&
        await tx.collectionAttempt.count({
          where: { invoice: { caseId: data.id }, OR: [
            { status: { in: OPEN_COLLECTIONS } },
            { status: "SUCCESSFUL", settledAt: null },
          ] },
        })) throw new FinanceError("A gateway collection is being checked or awaits settlement. Reconcile it before opening an off-site payment.");
      const summary = financialSummary(data);
      const touched = new Set([row.id]);
      const op = await tx.financialOperation.create({
        data: {
          caseId: base.id,
          actorId,
          intentKey: input.intentKey,
          inputHash: hash,
          action: input.action,
          evidence: input.evidence,
          changes: {},
        },
      });
      let resultId = base.id;
      let invalidateReview = false;
      let nextStatus = fresh.status;
      const amount = (allowZero = false) =>
        money(input.amount, input.currency, allowZero);
      const needTarget = () => {
        if (!input.targetId)
          throw new FinanceError("Select the target record.");
        return input.targetId;
      };
      const requireInstructions = () => {
        if (!data.instructions)
          throw new FinanceError(
            "Finance must record approved off-site payment instructions first.",
          );
      };
      const account = async () => {
        const found = input.accountId
          ? await tx.settlementAccount.findUnique({
              where: { id: input.accountId },
            })
          : null;
        if (!found?.active || found.currency !== data.currency)
          throw new FinanceError(
            "Choose an active approved account in this case's currency.",
          );
        return found;
      };
      const occurredAt = () => {
        let date: Date | null;
        try {
          date = input.date ? followUpDate(input.date) : new Date();
        } catch {
          throw new FinanceError(
            "Choose a real transaction date/time in Kigali.",
          );
        }
        if (!date || date.getTime() > Date.now() + 300000)
          throw new FinanceError("Transaction date cannot be in the future.");
        return date;
      };
      const proof = async (kind: string, partyKey: string, value: number) => {
        const acc = await account();
        const key = referenceKey(input.externalRef);
        if (await tx.collectionAttempt.count({ where: { settlementReference: `${acc.id}:${key}` } })) {
          throw new FinanceError("This statement reference already reconciles a gateway collection.");
        }
        const existing = await tx.settlementProof.findUnique({
          where: {
            accountId_referenceKey: { accountId: acc.id, referenceKey: key },
          },
          include: { entries: true },
        });
        if (existing) {
          if (
            kind === "RECEIPT" ||
            existing.kind !== kind ||
            existing.partyKey !== partyKey ||
            existing.caseId !== data.id ||
            !existing.entries.length ||
            existing.entries.reduce((n, e) => n + e.amountMinor, 0) !== 0
          )
            throw new FinanceError(
              "This account/statement reference is already recorded. Reuse its receipt allocation or reverse the incorrect record first.",
            );
          return tx.settlementProof.update({
            where: { id: existing.id },
            data: { amountMinor: value, occurredAt: occurredAt() },
          });
        }
        return tx.settlementProof.create({
          data: {
            caseId: data.id,
            accountId: acc.id,
            referenceKey: key,
            externalRef: input.externalRef,
            amountMinor: value,
            currency: data.currency,
            kind,
            partyKey,
            occurredAt: occurredAt(),
          },
        });
      };
      const entry = (
        kind: string,
        value: number,
        links: {
          proofId?: string;
          commitmentId?: string;
          refundId?: string;
          allocationId?: string;
          referenceKey?: string;
          reversesId?: string;
        } = {},
        caseId = data.id,
      ) =>
        tx.financialEntry.create({
          data: {
            caseId,
            operationId: op.id,
            kind,
            amountMinor: value,
            ...links,
          },
        });
      const reverse = async (
        original: Prisma.FinancialEntryGetPayload<Record<string, never>>,
      ) => {
        if (
          original.reversesId ||
          original.amountMinor < 0 ||
          (await tx.financialEntry.findUnique({
            where: { reversesId: original.id },
          }))
        )
          throw new FinanceError("This entry cannot be reversed again.");
        await entry(
          original.kind,
          -original.amountMinor,
          {
            reversesId: original.id,
            ...(original.proofId ? { proofId: original.proofId } : {}),
            ...(original.commitmentId
              ? { commitmentId: original.commitmentId }
              : {}),
            ...(original.refundId ? { refundId: original.refundId } : {}),
            ...(original.allocationId
              ? { allocationId: original.allocationId }
              : {}),
          },
          original.caseId,
        );
      };
      const touchCase = async (id: string) => {
        const other = await tx.financialCase.findUniqueOrThrow({
          where: { id },
        });
        touched.add(other.enquiryId);
      };
      const receiptInContext = async () => {
        const receipt = await tx.offsiteReceipt.findUnique({
          where: { id: needTarget() },
          include: { proof: true, allocations: true },
        });
        if (
          !receipt ||
          receipt.proof.currency !== data.currency ||
          (receipt.caseId !== data.id &&
            !receipt.allocations.some(
              (a) => a.caseId === data.id && a.status === "ACTIVE",
            ))
        )
          throw new FinanceError(
            "Receipt is not linked to this case or currency.",
          );
        return receipt;
      };
      const reverseAllocation = async (id: string) => {
        const allocation = await tx.receiptAllocation.findUnique({
          where: { id },
          include: { entries: true },
        });
        if (!allocation || allocation.status !== "ACTIVE")
          throw new FinanceError("Allocation is already released or missing.");
        const original = allocation.entries.find(
          (e) => e.kind === "RECEIPT" && !e.reversesId,
        );
        if (original) await reverse(original);
        await tx.receiptAllocation.update({
          where: { id },
          data: { status: "RELEASED" },
        });
        await touchCase(allocation.caseId);
      };
      switch (input.action) {
        case "INSTRUCTIONS": {
          const acc = await account();
          if (input.instructions && input.instructions.length < 10)
            throw new FinanceError(
              "Record complete approved payment instructions.",
            );
          await tx.financialCase.update({
            where: { id: data.id },
            data: {
              instructions: `[${acc.code}] ${input.instructions || acc.instructions}`,
            },
          });
          break;
        }
        case "RECORD_RECEIPT": {
          requireInstructions();
          if (input.payer.length < 2)
            throw new FinanceError("Record the payer shown by the receipt.");
          const value = amount();
          const allocated = input.secondaryAmount
            ? money(input.secondaryAmount, data.currency, true)
            : value;
          if (allocated > value)
            throw new FinanceError(
              "Initial allocation cannot exceed the receipt total.",
            );
          const p = await proof("RECEIPT", data.id, value);
          const receipt = await tx.offsiteReceipt.create({
            data: { caseId: data.id, proofId: p.id, payer: input.payer },
          });
          resultId = receipt.id;
          if (allocated)
            await tx.receiptAllocation.create({
              data: {
                caseId: data.id,
                receiptId: receipt.id,
                amountMinor: allocated,
              },
            });
          break;
        }
        case "ALLOCATE_RECEIPT": {
          const receipt = await tx.offsiteReceipt.findUnique({
            where: { id: needTarget() },
            include: { proof: true, allocations: true },
          });
          if (
            !receipt ||
            receipt.status === "REVERSED" ||
            receipt.proof.currency !== data.currency
          )
            throw new FinanceError(
              "Choose an unreversed receipt in the same currency.",
            );
          const value = amount();
          const used = receipt.allocations
            .filter((a) => a.status === "ACTIVE")
            .reduce((n, a) => n + a.amountMinor, 0);
          if (used + value > receipt.proof.amountMinor)
            throw new FinanceError(
              "Allocation exceeds the receipt's unallocated balance.",
            );
          const allocation = await tx.receiptAllocation.create({
            data: {
              caseId: data.id,
              receiptId: receipt.id,
              amountMinor: value,
            },
          });
          resultId = allocation.id;
          if (receipt.status === "RECONCILED")
            await entry("RECEIPT", value, {
              allocationId: allocation.id,
              proofId: receipt.proofId,
            });
          break;
        }
        case "AMEND_RECEIPT": {
          const receipt = await receiptInContext();
          if (receipt.status === "REVERSED")
            throw new FinanceError("A reversed receipt cannot be amended.");
          const value = amount();
          const allocated = receipt.allocations
            .filter((a) => a.status === "ACTIVE")
            .reduce((n, a) => n + a.amountMinor, 0);
          if (value < allocated)
            throw new FinanceError(
              "Release allocations before reducing the receipt below their total.",
            );
          await tx.settlementProof.update({
            where: { id: receipt.proofId },
            data: { amountMinor: value, occurredAt: occurredAt() },
          });
          resultId = receipt.id;
          break;
        }
        case "RECONCILE_RECEIPT": {
          const receipt = await receiptInContext();
          if (receipt.status !== "PENDING")
            throw new FinanceError("Only a pending receipt can be reconciled.");
          for (const allocation of receipt.allocations.filter(
            (a) => a.status === "ACTIVE",
          )) {
            await entry(
              "RECEIPT",
              allocation.amountMinor,
              { allocationId: allocation.id, proofId: receipt.proofId },
              allocation.caseId,
            );
            await touchCase(allocation.caseId);
          }
          await tx.offsiteReceipt.update({
            where: { id: receipt.id },
            data: {
              status: "RECONCILED",
              reconciledAt: new Date(),
              reconciledById: actorId,
            },
          });
          resultId = receipt.id;
          break;
        }
        case "RELEASE_ALLOCATION": {
          const allocation = await tx.receiptAllocation.findUnique({
            where: { id: needTarget() },
          });
          if (!allocation || allocation.caseId !== data.id)
            throw new FinanceError("Allocation not found in this case.");
          await reverseAllocation(allocation.id);
          resultId = allocation.id;
          break;
        }
        case "REVERSE_RECEIPT": {
          const receipt = await receiptInContext();
          if (receipt.status === "REVERSED")
            throw new FinanceError("Receipt is already reversed.");
          for (const allocation of receipt.allocations.filter(
            (a) => a.status === "ACTIVE",
          ))
            await reverseAllocation(allocation.id);
          await tx.offsiteReceipt.update({
            where: { id: receipt.id },
            data: { status: "REVERSED" },
          });
          resultId = receipt.id;
          break;
        }
        case "COMMIT_SUPPLIER": {
          if (
            !["AWAITING_PAYMENT", "PARTNER_PROCESSING"].includes(fresh.status)
          )
            throw new FinanceError(
              "Supplier commitments must be agreed before service confirmation; approved service changes need a separate review.",
            );
          const supplier = input.supplierId
            ? await tx.supplier.findUnique({ where: { id: input.supplierId } })
            : null;
          if (
            !supplier ||
            supplier.status !== "APPROVED" ||
            !supplier.currencies.includes(data.currency)
          )
            throw new FinanceError(
              "Choose an approved supplier accepting this currency.",
            );
          const categories: Record<string, string[]> = {
            FLIGHT: ["FLIGHT"],
            STAY: ["STAY"],
            TRANSPORT: ["TRANSPORT"],
            TRIP: ["TOUR", "STAY", "TRANSPORT", "FLIGHT"],
          };
          if (
            categories[row.service] &&
            !categories[row.service].includes(supplier.category)
          )
            throw new FinanceError(
              "Supplier category does not fulfil this service type.",
            );
          if (input.label.length < 2)
            throw new FinanceError("Describe the contracted supplier service.");
          const commitment = await tx.supplierCommitment.create({
            data: {
              caseId: data.id,
              supplierId: supplier.id,
              label: input.label,
              referenceKey: referenceKey(input.externalRef),
              contractRef: input.externalRef,
              costMinor: amount(true),
              evidence: input.evidence,
            },
          });
          resultId = commitment.id;
          invalidateReview = true;
          break;
        }
        case "SUPPLIER_DEBIT":
        case "SUPPLIER_CREDIT": {
          const commitment = data.commitments.find(
            (c) => c.id === needTarget(),
          );
          if (!commitment)
            throw new FinanceError("Supplier commitment not found.");
          const value = amount();
          if (
            input.action === "SUPPLIER_CREDIT" &&
            value > commitmentBalance(data, commitment.id).cost
          )
            throw new FinanceError(
              "Supplier credit would make the net cost negative.",
            );
          const e = await entry(input.action, value, {
            commitmentId: commitment.id,
            referenceKey: `${commitment.id}:adjust:${referenceKey(input.externalRef)}`,
          });
          resultId = e.id;
          invalidateReview = true;
          break;
        }
        case "SUPPLIER_PAYMENT":
        case "SUPPLIER_RECOVERY": {
          const commitment = data.commitments.find(
            (c) => c.id === needTarget(),
          );
          if (!commitment)
            throw new FinanceError("Supplier commitment not found.");
          const balance = commitmentBalance(data, commitment.id),
            value = amount();
          if (
            value >
            (input.action === "SUPPLIER_PAYMENT"
              ? balance.due
              : balance.recoveryDue)
          )
            throw new FinanceError(
              "Amount exceeds the supplier payable or recoverable balance.",
            );
          const p = await proof(input.action, commitment.id, value);
          resultId = (
            await entry(input.action, value, {
              commitmentId: commitment.id,
              proofId: p.id,
            })
          ).id;
          break;
        }
        case "PAYMENT_CHARGE":
        case "COMMISSION": {
          const value = amount();
          const p = await proof(input.action, data.id, value);
          resultId = (await entry(input.action, value, { proofId: p.id })).id;
          invalidateReview = true;
          break;
        }
        case "REVERSE_ENTRY": {
          const original = await tx.financialEntry.findFirst({
            where: { id: needTarget(), caseId: data.id },
          });
          if (!original) throw new FinanceError("Ledger entry not found.");
          if (original.kind === "REFUND_ADJUSTMENT")
            throw new FinanceError(
              "Use the refund amendment action to correct an obligation.",
            );
          if (original.kind === "RECEIPT")
            throw new FinanceError(
              "Release its receipt allocation or reverse the receipt instead.",
            );
          await reverse(original);
          resultId = original.id;
          if (
            [
              "SUPPLIER_CREDIT",
              "SUPPLIER_DEBIT",
              "PAYMENT_CHARGE",
              "COMMISSION",
            ].includes(original.kind)
          )
            invalidateReview = true;
          if (
            original.kind === "REFUND_SETTLEMENT" &&
            fresh.status === "REFUNDED"
          )
            nextStatus = "CANCELLED";
          break;
        }
        case "REVIEW": {
          const charge = amount(true),
            fee = money(input.feeAmount, data.currency, true),
            tax = money(input.taxAmount, data.currency, true),
            threshold = money(input.thresholdAmount, data.currency, true);
          const amended = ["CANCELLED", "REFUNDED", "COMPLETED"].includes(
            fresh.status,
          );
          if (
            (!amended &&
              (charge !== snapshot.totalMinor || fee !== quotedFee)) ||
            charge > snapshot.totalMinor ||
            fee > quotedFee ||
            tax > quotedTax + quotedOther ||
            fee + tax > charge ||
            (!amended && tax < quotedTax)
          )
            throw new FinanceError(
              "Live charges/fees must match the accepted quote. Completed/cancelled adjustments cannot exceed it; retain the approved tax/pass-through reserve.",
            );
          if (
            (!amended && (threshold <= 0 || threshold > charge)) ||
            (amended && threshold !== 0)
          )
            throw new FinanceError(
              "Set an approved positive funding threshold no greater than the live charge; closed-case thresholds must be zero.",
            );
          if (
            !data.commitments.length ||
            data.commitments.some((c) => c.supplier.status !== "APPROVED")
          )
            throw new FinanceError(
              "Record the full approved supplier costs before reviewing contribution.",
            );
          await tx.financialCase.update({
            where: { id: data.id },
            data: {
              customerChargeMinor: charge,
              serviceFeeMinor: fee,
              taxReserveMinor: tax,
              requiredFundingMinor: threshold,
              reviewed: true,
              reviewEvidence: input.evidence,
            },
          });
          break;
        }
        case "APPROVE_REFUND": {
          if (!data.reviewed)
            throw new FinanceError(
              "Review agreed charges, cancellation terms and complete supplier costs before approving a refund.",
            );
          const value = amount();
          if (value > summary.unallocatedCustomerCredit)
            throw new FinanceError(
              "Refund approval exceeds the uncommitted customer credit. Review the final charge or verify receipts first.",
            );
          const refund = await tx.customerRefund.create({
            data: {
              caseId: data.id,
              referenceKey: referenceKey(input.externalRef),
              amountMinor: value,
              reason: input.label || input.evidence,
              evidence: input.evidence,
            },
          });
          resultId = refund.id;
          break;
        }
        case "AMEND_REFUND": {
          const currentRefund = refundBalance(data, needTarget());
          const targetAmount = amount(true);
          const otherDue = summary.refundDue - currentRefund.due;
          if (
            targetAmount < currentRefund.settled ||
            targetAmount >
              currentRefund.settled +
                Math.max(0, summary.customerCredit - otherDue)
          )
            throw new FinanceError(
              "Refund amendment must cover settled payouts and cannot exceed available customer credit.",
            );
          const delta = targetAmount - currentRefund.approved;
          if (!delta) throw new FinanceError("No refund change to record.");
          resultId = (
            await entry("REFUND_ADJUSTMENT", delta, {
              refundId: input.targetId,
              referenceKey: `${input.targetId}:amend:${referenceKey(input.externalRef)}`,
            })
          ).id;
          break;
        }
        case "SETTLE_REFUND": {
          const balance = refundBalance(data, needTarget()),
            value = amount();
          if (value > balance.due || value > summary.netCustomerCash)
            throw new FinanceError(
              "Refund payout exceeds the approved outstanding obligation or available customer funds.",
            );
          const p = await proof("REFUND_SETTLEMENT", input.targetId, value);
          resultId = (
            await entry("REFUND_SETTLEMENT", value, {
              refundId: input.targetId,
              proofId: p.id,
            })
          ).id;
          break;
        }
        case "RELEASE_PROCESSING": {
          if (
            fresh.status !== "AWAITING_PAYMENT" ||
            !data.reviewed ||
            !summary.funded ||
            !data.commitments.length ||
            data.commitments.some((c) => c.supplier.status !== "APPROVED")
          )
            throw new FinanceError(
              "Processing requires an accepted quote, reviewed complete costs, approved suppliers and reconciled funding at the approved threshold.",
            );
          nextStatus = "PARTNER_PROCESSING";
          break;
        }
        case "CONFIRM_SUPPLIER": {
          if (
            fresh.status !== "PARTNER_PROCESSING" ||
            !data.reviewed ||
            !summary.funded
          )
            throw new FinanceError(
              "Release a funded reviewed case to processing before supplier checks.",
            );
          const commitment = data.commitments.find(
            (c) => c.id === needTarget(),
          );
          if (
            !commitment ||
            commitment.supplier.status !== "APPROVED" ||
            commitment.confirmationRef
          )
            throw new FinanceError(
              "Choose an approved, not-yet-confirmed supplier commitment.",
            );
          await tx.supplierCommitment.update({
            where: { id: commitment.id },
            data: {
              confirmationRef: referenceKey(input.externalRef),
              confirmedAt: new Date(),
              verifiedById: actorId,
              confirmationEvidence: input.evidence,
            },
          });
          resultId = commitment.id;
          break;
        }
        case "CONFIRM_SERVICE": {
          if (
            fresh.status !== "PARTNER_PROCESSING" ||
            !data.reviewed ||
            !summary.funded ||
            data.commitments.some((c) => c.supplier.status !== "APPROVED")
          )
            throw new FinanceError(
              "Finance must release a funded, reviewed case with approved suppliers before confirmation.",
            );
          const commitment = data.commitments.find(
            (c) => c.id === needTarget(),
          );
          if (!commitment)
            throw new FinanceError(
              "Choose this case's primary supplier commitment.",
            );
          if (
            data.commitments.some((c) => !c.confirmationRef) ||
            commitment.confirmationRef !== referenceKey(input.externalRef)
          )
            throw new FinanceError(
              "Verify every contracted supplier first, then use the primary supplier reference already checked.",
            );
          resultId = (
            await tx.enquiryFulfilment.create({
              data: {
                caseId: data.id,
                commitmentId: commitment.id,
                confirmationRef: referenceKey(input.externalRef),
                evidence: input.evidence,
                verifiedById: actorId,
              },
            })
          ).id;
          nextStatus = "CONFIRMED";
          break;
        }
        case "COMPLETE_SERVICE": {
          const fulfilment = await tx.enquiryFulfilment.findUnique({
            where: { caseId: data.id },
          });
          if (fresh.status !== "CONFIRMED" || !fulfilment)
            throw new FinanceError(
              "A checked supplier confirmation is required before completion.",
            );
          await tx.enquiryFulfilment.update({
            where: { id: fulfilment.id },
            data: { completedAt: new Date() },
          });
          resultId = fulfilment.id;
          nextStatus = "COMPLETED";
          break;
        }
        case "LINK_BOOKING": {
          const fulfilment = await tx.enquiryFulfilment.findUnique({
            where: { caseId: data.id },
          });
          const booking = await tx.booking.findUnique({
            where: { reference: input.bookingRef },
            include: { customer: true, payments: true },
          });
          const compatible =
            booking &&
            (
              {
                TRIP: ["TOUR"],
                STAY: ["ROOM"],
                TRANSPORT: ["VEHICLE", "TRANSFER"],
              } as Record<string, string[]>
            )[row.service]?.includes(booking.serviceType);
          const matches =
            booking &&
            ((row.email &&
              row.email.toLowerCase() ===
                booking.customer.email.toLowerCase()) ||
              (row.phone &&
                booking.customer.phone &&
                row.phone.replace(/\D/g, "") ===
                  booking.customer.phone.replace(/\D/g, "")));
          if (
            !fulfilment ||
            fulfilment.legacyBookingId ||
            !booking ||
            booking.status !== "COMPLETED" ||
            booking.payments.length ||
            !compatible ||
            !matches
          )
            throw new FinanceError(
              "Link only a matching completed historical booking with no payment attempts, after verifying identity and service. Existing paid/payable bookings must stay in their own ledger.",
            );
          await tx.enquiryFulfilment.update({
            where: { id: fulfilment.id },
            data: { legacyBookingId: booking.id },
          });
          resultId = fulfilment.id;
          break;
        }
      }
      if (invalidateReview)
        await tx.financialCase.update({
          where: { id: data.id },
          data: { reviewed: false, reviewEvidence: null },
        });
      // Validate every affected case before committing a correction or cross-case allocation.
      for (const enquiryId of touched) {
        const current = await tx.financialCase.findUniqueOrThrow({
          where: { enquiryId },
          include: financeInclude,
        });
        const totals = financialSummary(current);
        if (
          totals.netCustomerCash < 0 ||
          totals.refundDue < 0 ||
          current.commitments.some((c) => {
            const b = commitmentBalance(current, c.id);
            return b.cost < 0 || b.paid < 0;
          })
        )
          throw new FinanceError(
            "Correction conflicts with later refunds/recoveries. Reverse dependent records first.",
          );
        const priorCaseStatus =
          enquiryId === row.id
            ? fresh.status
            : (await tx.enquiry.findUniqueOrThrow({ where: { id: enquiryId } }))
                .status;
        let caseStatus = enquiryId === row.id ? nextStatus : priorCaseStatus;
        if (
          caseStatus === "REFUNDED" &&
          (totals.refundDue > 0 || totals.customerCredit > 0)
        )
          caseStatus = "CANCELLED";
        if (
          caseStatus === "CANCELLED" &&
          totals.refundObligations > 0 &&
          totals.refundDue === 0 &&
          totals.customerCredit === 0
        )
          caseStatus = "REFUNDED";
        if (enquiryId === row.id) nextStatus = caseStatus;
        await tx.enquiry.update({
          where: { id: enquiryId },
          data: { version: { increment: 1 }, status: caseStatus },
        });
        if (caseStatus !== priorCaseStatus)
          await enqueueWhatsAppStatus(tx, enquiryId);
        await tx.enquiryActivity.create({
          data: {
            enquiryId,
            actorId,
            kind: operational ? "FULFILMENT" : "FINANCE",
            changes: {
              operationId: op.id,
              action: input.action,
              recordId: resultId,
            },
            ...(operational ? { body: input.evidence } : {}),
          },
        });
      }
      const after = await tx.financialCase.findUniqueOrThrow({
        where: { id: data.id },
      });
      await tx.financialOperation.update({
        where: { id: op.id },
        data: {
          changes: {
            input: JSON.parse(JSON.stringify(input)),
            after: {
              chargeMinor: after.customerChargeMinor,
              feeMinor: after.serviceFeeMinor,
              reserveMinor: after.taxReserveMinor,
              thresholdMinor: after.requiredFundingMinor,
              reviewed: after.reviewed,
              instructions: after.instructions,
            },
            recordId: resultId,
            amount: input.amount,
            targetId: input.targetId,
            accountId: input.accountId,
            externalRef: input.externalRef,
            before: {
              status: fresh.status,
              chargeMinor: data.customerChargeMinor,
              feeMinor: data.serviceFeeMinor,
              reserveMinor: data.taxReserveMinor,
            },
            afterStatus: nextStatus,
          },
        },
      });
      return row.reference;
    },
    { timeout: 20000 },
  );
}
