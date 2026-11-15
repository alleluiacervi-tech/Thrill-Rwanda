import { z } from "zod";
import { followUpDate } from "@/lib/enquiry-workflow";
export const QUOTE_CURRENCIES = ["USD", "EUR", "GBP", "RWF"] as const;
export const LINE_KINDS = ["SUPPLIER", "SERVICE_FEE", "TAX", "OTHER"] as const;
export function toQuoteMinor(value: string, currency: string) {
  const decimals = currency === "RWF" ? 0 : 2;
  const pattern = decimals ? /^\d{1,8}(\.\d{1,2})?$/ : /^\d{1,9}$/;
  if (!pattern.test(value))
    throw new Error(
      `Enter a non-negative ${currency} amount with ${decimals} decimal places at most.`,
    );
  const [whole, fraction = ""] = value.split(".");
  const minor =
    Number(whole) * (decimals ? 100 : 1) +
    (decimals ? Number(fraction.padEnd(2, "0")) : 0);
  if (!Number.isSafeInteger(minor) || minor > 1_000_000_000)
    throw new Error("Amount is too large.");
  return minor;
}
export function formatQuoteMoney(minor: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    minor / (currency === "RWF" ? 1 : 100),
  );
}
const lineSchema = z.object({
  kind: z.enum(LINE_KINDS),
  description: z.string().trim().min(2).max(200),
  quantity: z.coerce.number().int().min(1).max(500),
  unitPrice: z.string().trim(),
});
export const quoteInputSchema = z
  .object({
    reference: z.string().min(4).max(80),
    enquiryVersion: z.coerce.number().int().min(0),
    intentKey: z.string().uuid(),
    currency: z.enum(QUOTE_CURRENCIES),
    serviceDescription: z.string().trim().min(10).max(2000),
    travelSummary: z.string().trim().min(5).max(2000),
    supplierConditions: z.string().trim().min(10).max(4000),
    taxTreatment: z.string().trim().min(5).max(1000),
    terms: z.string().trim().min(20).max(6000),
    expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    paymentDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    lines: z.array(lineSchema).min(2).max(30),
    internalNotes: z.string().trim().max(3000).default(""),
    checked: z.literal(true, {
      error: "Confirm supplier checks and quotation terms before issuing",
    }),
    sendEmail: z.boolean(),
  })
  .superRefine((input, ctx) => {
    for (const name of ["expiresAt", "paymentDeadline"] as const) {
      try {
        followUpDate(input[name]);
      } catch {
        ctx.addIssue({
          code: "custom",
          path: [name],
          message: "Choose a real date and time",
        });
      }
    }
    for (const kind of ["SUPPLIER", "SERVICE_FEE"])
      if (!input.lines.some((line) => line.kind === kind))
        ctx.addIssue({
          code: "custom",
          path: ["lines"],
          message:
            "Include separate supplier charges and service fee lines, even when the fee is zero",
        });
    try {
      const total = quoteTotals(input.lines, input.currency).totalMinor;
      if (total <= 0 || total > 2_000_000_000)
        throw new Error(
          "Total must be positive and no greater than 2 billion minor units.",
        );
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        path: ["lines"],
        message: (error as Error).message,
      });
    }
  });
export type QuoteInput = z.infer<typeof quoteInputSchema>;
export function quoteTotals(
  lines: z.infer<typeof lineSchema>[],
  currency: string,
) {
  const items = lines.map((line) => {
    const unitMinor = toQuoteMinor(line.unitPrice, currency);
    return {
      kind: line.kind,
      description: line.description,
      quantity: line.quantity,
      unitMinor,
      totalMinor: unitMinor * line.quantity,
    };
  });
  const totalMinor = items.reduce((sum, line) => sum + line.totalMinor, 0);
  if (!Number.isSafeInteger(totalMinor))
    throw new Error("Quote total is too large.");
  return { items, totalMinor };
}
export type QuoteSnapshot = {
  reference: string;
  version: number;
  customerName: string;
  preparedBy: string;
  company: { name: string; email: string; phone: string; address: string };
  issuedAt: string;
  expiresAt: string;
  paymentDeadline: string;
  currency: string;
  serviceDescription: string;
  travelSummary: string;
  supplierConditions: string;
  taxTreatment: string;
  terms: string;
  items: ReturnType<typeof quoteTotals>["items"];
  totalMinor: number;
};
export const acceptanceSchema = z.object({
  reference: z.string().min(4).max(80),
  quoteId: z.string().uuid(),
  enquiryVersion: z.coerce.number().int().min(0),
  customerName: z.string().trim().min(2).max(120),
  channel: z.enum(["EMAIL", "PHONE", "WHATSAPP", "IN_PERSON"]),
  evidence: z.string().trim().min(10).max(2000),
  verified: z.literal(true, {
    error: "Verify customer acceptance of this exact version and its terms",
  }),
});
export type AcceptanceInput = z.infer<typeof acceptanceSchema>;
export type QuoteActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};
