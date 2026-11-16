import { z } from "zod";
import { enquiryDateSchema } from "@/lib/flight-enquiry-schema";
import {
  ADD_ONS,
  AGE_GROUPS,
  EVENT_NEEDS,
  EVENT_TYPES,
  JOURNEY_KEYS,
  JOURNEY_SERVICE,
  VENUE_STYLES,
  listOf,
} from "@/lib/journey-requests";

/** One of a fixed list of choices, or blank when the question was not asked. */
const choice = (allowed: readonly string[]) =>
  z
    .string()
    .trim()
    .max(80)
    .default("")
    .refine((v) => v === "" || allowed.includes(v), "Choose one of the listed options");

export const serviceEnquirySchema = z
  .object({
    submissionKey: z.string().uuid(),
    service: z.enum([
      "GENERAL",
      "FLIGHT",
      "TRIP",
      "STAY",
      "TRANSPORT",
      "GROUP",
      "EVENT",
    ]),
    name: z.string().trim().min(2).max(120),
    phone: z
      .string()
      .trim()
      .max(40)
      .regex(/^\+?[\d ()-]*$/),
    email: z.string().trim().toLowerCase().max(254).email().or(z.literal("")),
    replyChannel: z.enum(["WHATSAPP", "PHONE", "EMAIL"]),
    startDate: enquiryDateSchema.or(z.literal("")),
    endDate: enquiryDateSchema.or(z.literal("")),
    flexible: z.boolean(),
    partySize: z.coerce.number().int().min(1).max(500),
    origin: z.string().trim().max(120).default(""),
    destination: z.string().trim().max(120).default(""),
    location: z.string().trim().max(200),
    pickup: z.string().trim().max(200),
    dropoff: z.string().trim().max(200),
    organization: z.string().trim().max(160),
    budget: z.string().trim().max(100),
    message: z
      .string()
      .trim()
      .min(10, "Please tell us more (at least 10 characters)")
      .max(4000),
    context: z.string().trim().max(1000),
    // Tailored requests (src/lib/journey-requests.ts). All optional, so the
    // general form and forms opened before this was added keep working.
    journey: z.enum(JOURNEY_KEYS).or(z.literal("")).default(""),
    eventType: choice(EVENT_TYPES),
    venueStyle: choice(VENUE_STYLES),
    needs: z.string().trim().max(300).default(""),
    students: z.coerce.number().int().min(0).max(2000).default(0),
    chaperones: z.coerce.number().int().min(0).max(500).default(0),
    ageGroup: choice(AGE_GROUPS),
    learningFocus: z.string().trim().max(200).default(""),
    addOns: z.string().trim().max(300).default(""),
    consent: z.literal(true, {
      error:
        "Please read the privacy notice and agree to contact about this request",
    }),
    website: z.string().max(0),
  })
  .superRefine((v, ctx) => {
    const issue = (field: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [field], message });
    if (
      v.service === "FLIGHT" &&
      (!v.origin ||
        !v.destination ||
        v.origin.toLowerCase() === v.destination.toLowerCase())
    )
      issue("origin", "Enter different departure and destination cities");
    if (!v.phone && !v.email) issue("phone", "Enter a phone number or email");
    if (v.phone && v.phone.replace(/\D/g, "").length < 7)
      issue("phone", "Enter a valid phone number");
    if (v.replyChannel === "EMAIL" && !v.email)
      issue("email", "Email is required for this reply channel");
    if (v.replyChannel !== "EMAIL" && !v.phone)
      issue("phone", "Phone is required for this reply channel");
    if (v.endDate && (!v.startDate || v.endDate < v.startDate))
      issue("endDate", "Choose dates in order");
    if (["TRIP", "STAY", "EVENT"].includes(v.service) && !v.location)
      issue("location", "Enter your destination or preferred location");
    if (v.service === "TRANSPORT" && (!v.pickup || !v.dropoff))
      issue("pickup", "Enter both pickup and drop-off locations");
    if (v.service === "GROUP" && !v.organization)
      issue("organization", "Enter your organization or group name");
    if (v.journey && JOURNEY_SERVICE[v.journey] !== v.service)
      issue("journey", "This request does not match the selected service");
    if (!listOf(v.needs, EVENT_NEEDS))
      issue("needs", "Choose from the listed options");
    if (!listOf(v.addOns, ADD_ONS.map((a) => a.label)))
      issue("addOns", "Choose from the listed options");
    if (v.journey === "SCHOOL" && v.students < 1)
      issue("students", "Enter the number of students travelling");
    if (v.students + v.chaperones > 0 && v.students + v.chaperones > v.partySize)
      issue("partySize", "The total travelling must include every student and staff member");
  });
export type ServiceEnquiryInput = z.infer<typeof serviceEnquirySchema>;
