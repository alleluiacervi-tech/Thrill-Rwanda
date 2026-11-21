import { describe, expect, it } from "vitest";
import { serviceEnquirySchema } from "./service-enquiry-schema";
const input = {
  submissionKey: "55cb5b18-56d3-42ac-893a-acab45440714",
  service: "GENERAL",
  name: "Test Guest",
  phone: "",
  email: "guest@example.invalid",
  replyChannel: "EMAIL",
  startDate: "",
  endDate: "",
  flexible: false,
  partySize: "2",
  location: "",
  pickup: "",
  dropoff: "",
  organization: "",
  budget: "",
  message: "Please help plan a trip",
  context: "Catalogue handoff",
  consent: true,
  website: "",
};
describe("service-aware guest capture", () => {
  it("requires a business event type and organization on business briefs", () => {
    const brief = {
      ...input,
      service: "EVENT",
      journey: "BUSINESS_EVENT",
      location: "Kigali",
      organization: "Example Company",
      eventType: "Meeting or conference",
    };
    expect(serviceEnquirySchema.parse(brief)).toMatchObject({
      journey: "BUSINESS_EVENT",
      eventType: "Meeting or conference",
    });
    expect(serviceEnquirySchema.safeParse({ ...brief, organization: "" }).success).toBe(false);
    expect(serviceEnquirySchema.safeParse({ ...brief, eventType: "Wedding" }).success).toBe(false);
    expect(serviceEnquirySchema.parse({ ...brief, partySize: "2500" }).partySize).toBe(2500);
    expect(serviceEnquirySchema.safeParse({ ...brief, partySize: "10001" }).success).toBe(false);
  });
  it("accepts email-only contact and optional dates", () => {
    expect(serviceEnquirySchema.parse(input).partySize).toBe(2);
  });
  it.each([
    { service: "TRIP" },
    { service: "STAY" },
    { service: "EVENT" },
    { service: "TRANSPORT", pickup: "Kigali" },
    { service: "GROUP" },
    { service: "FLIGHT", origin: "Kigali", destination: "Kigali" },
    { replyChannel: "WHATSAPP" },
    { consent: false },
    { endDate: "2027-01-01" },
    { partySize: 501 },
    { website: "bot" },
  ])("rejects incomplete service/contact/consent details %j", (change) => {
    expect(
      serviceEnquirySchema.safeParse({ ...input, ...change }).success,
    ).toBe(false);
  });
  it("leaves tailored fields blank on a general request", () => {
    const parsed = serviceEnquirySchema.parse(input);
    expect(parsed).toMatchObject({ journey: "", eventType: "", needs: "", addOns: "", students: 0 });
  });
  it("accepts a wedding request with its venue questions and add-ons", () => {
    const parsed = serviceEnquirySchema.parse({
      ...input,
      service: "EVENT",
      journey: "WEDDING",
      location: "Lake Kivu",
      partySize: "180",
      eventType: "Wedding",
      venueStyle: "Garden or lakeshore",
      needs: "Venue reservation, Guest transport",
      addOns: "A honeymoon, Flights",
    });
    expect(parsed.needs).toBe("Venue reservation, Guest transport");
    expect(parsed.partySize).toBe(180);
  });
  it("accepts a school trip with students and staff inside the total", () => {
    expect(
      serviceEnquirySchema.parse({
        ...input,
        service: "GROUP",
        journey: "SCHOOL",
        organization: "Example Academy",
        partySize: "44",
        students: "40",
        chaperones: "4",
        ageGroup: "Upper secondary",
        learningFocus: "Conservation and biology",
      }).students,
    ).toBe(40);
  });
  it.each([
    // A journey filed under the wrong service.
    { service: "TRIP", location: "Kigali", journey: "WEDDING" },
    // Choices that were never offered.
    { service: "EVENT", location: "Kigali", journey: "WEDDING", venueStyle: "Castle" },
    { service: "EVENT", location: "Kigali", journey: "WEDDING", needs: "Venue reservation, Fireworks" },
    { addOns: "Flights, <script>" },
    { journey: "CRUISE" },
    // A school trip with no students, or more people than the stated total.
    { service: "GROUP", organization: "Example Academy", journey: "SCHOOL", students: "0" },
    { service: "GROUP", organization: "Example Academy", journey: "SCHOOL", partySize: "10", students: "40", chaperones: "4" },
  ])("rejects tailored details that do not hold together %j", (change) => {
    expect(
      serviceEnquirySchema.safeParse({ ...input, ...change }).success,
    ).toBe(false);
  });
  it("accepts transport and retains requested pickup/drop-off", () => {
    expect(
      serviceEnquirySchema.parse({
        ...input,
        service: "TRANSPORT",
        pickup: "Airport",
        dropoff: "Kigali",
      }).pickup,
    ).toBe("Airport");
  });
});
