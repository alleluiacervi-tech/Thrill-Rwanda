/** Turns a form field name into the words a person would use for it. */

/** Field names whose humanised form would read badly. */
const LABELS: Record<string, string> = {
  accountId: "Account",
  ownerId: "Owner",
  supplierId: "Supplier",
  providerId: "Provider",
  targetId: "Item",
  externalRef: "Reference",
  enquiryRef: "Enquiry reference",
  bookingRef: "Booking reference",
  pnr: "Booking reference (PNR)",
  evidence: "Evidence",
  approvalEvidence: "Approval evidence",
  permissionEvidence: "Permission evidence",
  verified: "Confirmation",
  consent: "Consent",
  expiresAt: "Valid until",
  nextActionAt: "Next action",
  followUp: "Follow-up",
  ticketTimeLimit: "Ticketing time limit",
  url: "Web address",
};

/** "signedName" -> "Signed name", "first_name" -> "First name". */
export function fieldLabel(path: readonly PropertyKey[] | undefined): string {
  const key = [...(path ?? [])].reverse().find((p) => typeof p === "string") as string | undefined;
  if (!key) return "This field";
  if (LABELS[key]) return LABELS[key];
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "This field";
}
