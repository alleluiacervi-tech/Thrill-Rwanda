/**
 * The customer emails an admin may reword — the data only.
 *
 * Kept apart from templates.ts so the admin editor, a client component, can
 * import the wording and the placeholder list without pulling the database
 * client into the browser bundle.
 *
 * The customer emails an admin may reword.
 *
 * Each one ships with its own copy; an admin's version overrides it. The
 * placeholders are filled from the booking, so an admin can change the words
 * without touching the facts — and a typo in a placeholder leaves the
 * surrounding sentence intact rather than breaking the email.
 */

export type Placeholder = { token: string; describes: string; sample: string };

/** Every placeholder any template may use. Unknown ones are left as typed. */
export const PLACEHOLDERS: Placeholder[] = [
  { token: "{customerName}", describes: "The customer's first name", sample: "Amina" },
  { token: "{reference}", describes: "Booking reference", sample: "TR-GPBG5C" },
  { token: "{listing}", describes: "What was booked", sample: "2-Day Gorilla Trekking" },
  { token: "{provider}", describes: "The provider's business name", sample: "Volcano Trails Rwanda" },
  { token: "{dates}", describes: "Travel dates", sample: "29 Sept – 1 Oct" },
  { token: "{guests}", describes: "Guests or passengers", sample: "2 guests" },
  { token: "{total}", describes: "Booking total", sample: "$1,680" },
  { token: "{amount}", describes: "Amount just paid", sample: "$504" },
  { token: "{balance}", describes: "What is still owed", sample: "$1,176" },
  { token: "{siteName}", describes: "Your business name", sample: "Thrill Rwanda" },
  {
    token: "{nextStep}",
    describes: "How to pay: online for most bookings, at the property for hotels",
    sample: "You can pay and follow progress from your booking page.",
  },
];

export type TemplateKey =
  | "booking.created"
  | "booking.confirmed"
  | "booking.rejected"
  | "booking.cancelled"
  | "booking.completed"
  | "payment.deposit"
  | "payment.full"
  | "account.created";

type Definition = {
  key: TemplateKey;
  label: string;
  /** When this email is sent, in the admin's words. */
  when: string;
  subject: string;
  body: string;
  ctaLabel: string;
  /** Placeholders that carry real values for this email. */
  uses: string[];
};

/** The built-in copy. Kept here so "reset to default" has something to restore. */
export const TEMPLATES: Definition[] = [
  {
    key: "booking.created",
    label: "Booking received",
    when: "As soon as a customer books, before the provider confirms.",
    subject: "Booking {reference} received",
    body: `Thanks for booking {listing} with us. Your dates are held while {provider} confirms availability, which usually takes a few hours.

We'll email you as soon as it's confirmed. {nextStep}`,
    ctaLabel: "View your booking",
    uses: ["{customerName}", "{reference}", "{listing}", "{provider}", "{dates}", "{guests}", "{total}", "{nextStep}"],
  },
  {
    key: "booking.confirmed",
    label: "Booking confirmed",
    when: "When the provider or an admin confirms the booking.",
    subject: "Booking {reference} confirmed",
    body: `{provider} has confirmed your booking. You're all set — we'll be in touch with the final details before you travel.`,
    ctaLabel: "View your booking",
    uses: ["{customerName}", "{reference}", "{listing}", "{provider}", "{dates}", "{total}"],
  },
  {
    key: "booking.rejected",
    label: "Booking declined",
    when: "When the provider cannot take the booking.",
    subject: "Booking {reference} could not be taken",
    body: `{provider} can't take these dates, so nothing has been charged. Reply to this email and we'll find you an alternative.`,
    ctaLabel: "View your booking",
    uses: ["{customerName}", "{reference}", "{listing}", "{provider}", "{dates}"],
  },
  {
    key: "booking.cancelled",
    label: "Booking cancelled",
    when: "When a booking is cancelled by the customer or an admin.",
    subject: "Booking {reference} cancelled",
    body: `This booking has been cancelled and the dates released. Any deposit will be refunded under our cancellation policy.`,
    ctaLabel: "View your booking",
    uses: ["{customerName}", "{reference}", "{listing}", "{dates}"],
  },
  {
    key: "booking.completed",
    label: "Trip completed",
    when: "When the trip is marked complete. Invites a review.",
    subject: "How was it?",
    body: `Your trip is marked complete. If you have a minute, leaving a review helps other travellers and the operator alike.`,
    ctaLabel: "Leave a review",
    uses: ["{customerName}", "{reference}", "{listing}", "{provider}"],
  },
  {
    key: "payment.deposit",
    label: "Deposit receipt",
    when: "When a deposit clears and a balance is still owed.",
    subject: "Deposit received for {reference}",
    body: `We have your {amount} deposit. The balance of {balance} can be paid from your booking page before your trip.`,
    ctaLabel: "View booking and balance",
    uses: ["{customerName}", "{reference}", "{listing}", "{amount}", "{balance}", "{total}"],
  },
  {
    key: "payment.full",
    label: "Payment receipt",
    when: "When a booking becomes fully paid.",
    subject: "Payment received for {reference}",
    body: `We have your {amount} and the booking is paid in full. {provider} will confirm the final details.`,
    ctaLabel: "View your booking",
    uses: ["{customerName}", "{reference}", "{listing}", "{provider}", "{amount}", "{total}"],
  },
  {
    key: "account.created",
    label: "Welcome",
    when: "When someone creates an account.",
    subject: "Welcome to {siteName}",
    body: `Your account is ready. Safaris, hotel stays, car hire and airport transfers you book with us will all live in one place, with your payments and receipts alongside.

Every provider on {siteName} is checked by our team before they can take bookings. You pay a deposit to confirm and the balance later.`,
    ctaLabel: "Go to your account",
    uses: ["{customerName}", "{siteName}"],
  },
];

export const TEMPLATE_BY_KEY = new Map(TEMPLATES.map((t) => [t.key, t]));

/** Replaces the placeholders a caller supplies, and leaves anything else alone. */
export function fill(text: string, values: Record<string, string | undefined>) {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole);
}

/** Sample values for the admin preview. */
export function sampleValues(): Record<string, string> {
  return Object.fromEntries(PLACEHOLDERS.map((p) => [p.token.slice(1, -1), p.sample]));
}
