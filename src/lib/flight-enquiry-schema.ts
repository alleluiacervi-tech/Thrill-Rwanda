import { z } from "zod";

export const ENQUIRY_CONSENT_VERSION = "flight-enquiry-v1";
export const ENQUIRY_CONSENT_TEXT =
  "I have read the privacy notice and agree to be contacted about this request.";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Choose a real calendar date");

export const flightEnquirySchema = z
  .object({
    submissionKey: z.string().uuid("Reload the form before submitting"),
    name: z.string().trim().min(2, "Enter your name").max(120),
    phone: z
      .string()
      .trim()
      .min(7, "Enter your phone or WhatsApp number")
      .max(40)
      .regex(/^\+?[\d ()-]+$/, "Enter a valid phone number")
      .refine(
        (v) => v.replace(/\D/g, "").length >= 7,
        "Enter a valid phone number",
      ),
    email: z
      .string()
      .trim()
      .max(254)
      .email("Enter a valid email")
      .or(z.literal("")),
    replyChannel: z.enum(["WHATSAPP", "PHONE", "EMAIL"]),
    origin: z
      .string()
      .trim()
      .min(2, "Enter your departure city or airport")
      .max(120),
    destination: z
      .string()
      .trim()
      .min(2, "Enter your destination city or airport")
      .max(120),
    tripType: z.enum(["RETURN", "ONE_WAY"]),
    departureDate: date,
    returnDate: date.or(z.literal("")),
    flexible: z.boolean(),
    adults: z.coerce.number().int().min(1).max(20),
    children: z.coerce.number().int().min(0).max(20),
    infants: z.coerce.number().int().min(0).max(20),
    cabin: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]),
    baggage: z.string().trim().max(500),
    notes: z.string().trim().max(2000),
    consent: z.literal(true, {
      error: "Read the privacy notice and agree to contact about this request",
    }),
    website: z.string().max(0, "Unable to accept this request"),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (v.origin.toLowerCase() === v.destination.toLowerCase())
      issue("destination", "Choose a different destination");
    if (v.tripType === "RETURN" && !v.returnDate)
      issue("returnDate", "Choose your return date");
    if (
      v.tripType === "RETURN" &&
      v.returnDate &&
      v.returnDate < v.departureDate
    )
      issue("returnDate", "Return cannot be before departure");
    if (v.tripType === "ONE_WAY" && v.returnDate)
      issue("returnDate", "Clear the return date for a one-way trip");
    if (v.replyChannel === "EMAIL" && !v.email)
      issue("email", "Enter an email for your preferred reply channel");
    if (v.adults + v.children + v.infants > 20)
      issue("adults", "For more than 20 travellers, please contact us");
    if (v.infants > v.adults)
      issue("infants", "Each infant needs an accompanying adult");
  });

export type FlightEnquiryInput = z.infer<typeof flightEnquirySchema>;
export type FlightEnquiryState = {
  status: "idle" | "error" | "success";
  message?: string;
  reference?: string;
  fieldErrors?: Record<string, string>;
};

// Africa/Kigali has no daylight-saving changes. Validate civil dates in the business timezone.
export function todayInRwanda(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
