import { renderEmail, type RenderedEmail } from "@/lib/email/template";

// Made-up data for the admin preview page only; real emails are built in notifications.ts, auth.ts and enquiry.ts.
const booking: [string, string][] = [
  ["Reference", "SW-GPBG5C"],
  ["Safari · Volcanoes", "2-Day Gorilla Trekking"],
  ["Dates", "29 Sept – 1 Oct"],
  ["Guests", "2 guests"],
  ["Total", "Ksh 84,000"],
];

export const emailSamples: { id: string; label: string; audience: string; email: RenderedEmail }[] = [
  {
    id: "booking-received",
    label: "Booking received",
    audience: "Customer",
    email: renderEmail({
      subject: "Booking SW-GPBG5C received",
      name: "Amina Uwimana",
      paragraphs: [
        "Thanks for booking 2-Day Gorilla Trekking with us. Your dates are held while Volcano Trails Rwanda confirms availability, which usually takes a few hours.",
        "We'll email you as soon as it's confirmed. You can pay and follow progress from your booking page.",
      ],
      details: booking,
      cta: { label: "View your booking", href: "/account/bookings/SW-GPBG5C" },
      note: "Plans changed? Reply to this email or call us and we'll help before anything is charged.",
    }),
  },
  {
    id: "deposit-receipt",
    label: "Deposit receipt",
    audience: "Customer",
    email: renderEmail({
      subject: "Deposit received for SW-GPBG5C",
      name: "Amina Uwimana",
      paragraphs: ["We have your Ksh 25,200 deposit. The balance of Ksh 58,800 can be paid from your booking page before your trip."],
      details: [...booking, ["Paid now", "Ksh 25,200"], ["Paid so far", "Ksh 25,200"], ["Balance due", "Ksh 58,800"]],
      cta: { label: "View booking and balance", href: "/account/bookings/SW-GPBG5C" },
      note: "Keep this payment confirmation with your booking records.",
    }),
  },
  {
    id: "booking-confirmed",
    label: "Booking confirmed",
    audience: "Customer",
    email: renderEmail({
      subject: "Booking SW-GPBG5C confirmed",
      name: "Amina Uwimana",
      paragraphs: ["Volcano Trails Rwanda has confirmed your booking. You're all set — we'll be in touch with the final details before you travel."],
      details: booking,
      cta: { label: "View your booking", href: "/account/bookings/SW-GPBG5C" },
    }),
  },
  {
    id: "booking-declined",
    label: "Booking declined",
    audience: "Customer",
    email: renderEmail({
      subject: "Booking SW-GPBG5C could not be taken",
      name: "Amina Uwimana",
      paragraphs: ["Volcano Trails Rwanda can't take these dates, so nothing has been charged. Reply to this email and we'll find you an alternative."],
      details: booking,
      cta: { label: "View your booking", href: "/account/bookings/SW-GPBG5C" },
      tone: "warning",
    }),
  },
  {
    id: "new-booking-provider",
    label: "New booking",
    audience: "Provider",
    email: renderEmail({
      subject: "New booking SW-GPBG5C",
      name: "Peter Otieno",
      paragraphs: ["Amina Uwimana has booked 2-Day Gorilla Trekking. Please confirm or decline it from your dashboard so the guest isn't left waiting."],
      details: booking,
      cta: { label: "Review booking", href: "/provider/bookings" },
    }),
  },
  {
    id: "welcome",
    label: "Welcome",
    audience: "Customer",
    email: renderEmail({
      subject: "Welcome to Thrill Rwanda",
      name: "Amina Uwimana",
      paragraphs: [
        "Your account is ready. Safaris, hotel stays, car hire and airport transfers you book with us will all live in one place, with your payments and receipts alongside.",
        "Every provider on Thrill Rwanda is checked by our team before they can take bookings. You pay a deposit to confirm and the balance later.",
      ],
      cta: { label: "Go to your account", href: "/account" },
      note: "Didn't create this account? Reply to this email and we'll close it.",
    }),
  },
  {
    id: "password-reset",
    label: "Password reset",
    audience: "Anyone",
    email: renderEmail({
      subject: "Reset your Thrill Rwanda password",
      heading: "Reset your password",
      name: "Amina Uwimana",
      paragraphs: ["We received a request to reset the password on your account. Choose a new one using the button below."],
      cta: { label: "Choose a new password", href: "/reset-password?token=example" },
      note: "This link expires in one hour and works once. If you didn't ask for it, ignore this email and your password stays the same.",
    }),
  },
  {
    id: "enquiry",
    label: "Website enquiry",
    audience: "Your team",
    email: renderEmail({
      subject: "Enquiry: Group safari in December",
      heading: "New website enquiry",
      paragraphs: ["Hello, we are a group of 8 looking at a gorilla and Akagera trip from 12 December. Could you send options with accommodation?"],
      details: [
        ["Name", "James Mwangi"],
        ["Email", "james@example.com"],
        ["Phone", "+250 788 000 000"],
        ["Subject", "Group safari in December"],
      ],
      cta: { label: "Reply to James", href: "mailto:james@example.com" },
      footer: "Sent from the contact form on the website. Replying goes straight to the customer.",
    }),
  },
];
