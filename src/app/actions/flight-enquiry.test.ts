import {publicPreviewAllowed} from "@/lib/soft-launch";
vi.mock("@/lib/soft-launch",()=>({publicPreviewAllowed:vi.fn(async()=>true)}));
import { beforeEach, expect, it, vi } from "vitest";
const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/lib/flight-enquiries", () => ({
  saveFlightEnquiry: save,
  EnquirySubmissionError: class extends Error {},
}));
import { submitFlightEnquiry } from "./flight-enquiry";
const form = () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    submissionKey: "b54316cb-06b1-4347-b123-ec4b69fbe125",
    name: "Test Traveller",
    phone: "+250788000001",
    email: "",
    replyChannel: "PHONE",
    origin: "Kigali",
    destination: "Nairobi",
    tripType: "ONE_WAY",
    departureDate: "2090-01-01",
    returnDate: "",
    adults: "1",
    children: "0",
    infants: "0",
    cabin: "ECONOMY",
    baggage: "",
    notes: "",
    consent: "on",
    website: "",
  }))
    data.set(key, value);
  return data;
};
beforeEach(() => {
  vi.resetAllMocks(); vi.mocked(publicPreviewAllowed).mockResolvedValue(true);
  save.mockResolvedValue({ reference: "TRQ-test" });
});
it("passes ordered multi-city legs and the nonstop requirement to storage", async () => {
  const data = form();
  data.set("tripType", "MULTI_CITY");
  data.set("nonstopOnly", "on");
  data.append("legOrigin", "Nairobi");
  data.append("legDestination", "London");
  data.append("legDate", "2090-01-05");
  expect((await submitFlightEnquiry({ status: "idle" }, data)).status).toBe("success");
  expect(save).toHaveBeenCalledWith(expect.objectContaining({
    nonstopOnly: true, additionalLegs: [{ origin: "Nairobi", destination: "London", departureDate: "2090-01-05" }],
  }));
});
it("reports success only after saving a valid guest request", async () => {
  expect(await submitFlightEnquiry({ status: "idle" }, form())).toEqual({
    status: "success",
    reference: "TRQ-test",
  });
});
it("rejects past departures before writing", async () => {
  const data = form();
  data.set("departureDate", "2000-01-01");
  expect(
    (await submitFlightEnquiry({ status: "idle" }, data)).fieldErrors,
  ).toHaveProperty("departureDate");
  expect(save).not.toHaveBeenCalled();
});
it("requires affirmative consent before writing", async () => {
  const data = form();
  data.delete("consent");
  expect(
    (await submitFlightEnquiry({ status: "idle" }, data)).fieldErrors,
  ).toHaveProperty("consent");
  expect(save).not.toHaveBeenCalled();
});
it("does not expose database details or claim success when saving fails", async () => {
  save.mockRejectedValue(new Error("private database connection details"));
  const result = await submitFlightEnquiry({ status: "idle" }, form());
  expect(result.status).toBe("error");
  expect(result.reference).toBeUndefined();
  expect(JSON.stringify(result)).not.toContain("private database");
});

it("rejects uninvited private-preview requests before saving",async()=>{vi.mocked(publicPreviewAllowed).mockResolvedValue(false);const result=await submitFlightEnquiry({status:"idle"},form());expect(result.status).toBe("error");expect(result.message).toContain("invited");expect(save).not.toHaveBeenCalled();});
