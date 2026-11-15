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
