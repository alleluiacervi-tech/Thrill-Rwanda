import { beforeEach, expect, it, vi } from "vitest";
const { save, staff } = vi.hoisted(() => ({ save: vi.fn(), staff: vi.fn() }));
vi.mock("@/lib/flight-enquiries", () => ({ saveEnquiry: save, EnquirySubmissionError: class extends Error {} }));
vi.mock("@/lib/enquiry-access", () => ({ requireEnquiryStaff: staff }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { submitServiceEnquiry, captureManualEnquiry } from "./service-enquiry";
const form = () => {
 const data = new FormData();
 for (const [key, value] of Object.entries({ submissionKey: "55cb5b18-56d3-42ac-893a-acab45440714", service: "GENERAL", name: "Test Guest", phone: "", email: "guest@example.invalid", replyChannel: "EMAIL", startDate: "", endDate: "", partySize: "2", location: "", pickup: "", dropoff: "", organization: "", budget: "", message: "Please help us plan our trip", context: "Catalogue request", consent: "on", website: "" })) data.set(key, value);
 return data;
};
beforeEach(() => { vi.resetAllMocks(); save.mockResolvedValue({ reference: "TRQ-test" }); staff.mockResolvedValue({ id: "staff", role: "CUSTOMER", staffRole: "SALES", isActive: true }); });
it("persists website requests and ignores a spoofed lead source", async () => {
 const data = form(); data.set("source", "PHONE");
 expect((await submitServiceEnquiry({ status: "idle" }, data)).status).toBe("success");
 expect(save.mock.calls[0][0]).toMatchObject({ source: "WEBSITE", service: "GENERAL", consentVersion: "service-enquiry-v1" });
});
it("rejects absent consent and past public dates before saving", async () => {
 const data = form(); data.delete("consent");
 expect((await submitServiceEnquiry({ status: "idle" }, data)).status).toBe("error");
 data.set("consent", "on"); data.set("startDate", "2000-01-01");
 expect((await submitServiceEnquiry({ status: "idle" }, data)).fieldErrors).toHaveProperty("startDate");
 expect(save).not.toHaveBeenCalled();
});
it("requires permission evidence on manual captures", async () => {
 const data = form(); data.set("source", "PHONE");
 expect((await captureManualEnquiry({ status: "idle" }, data)).status).toBe("error");
 expect(save).not.toHaveBeenCalled();
});
it("records staff identity, source and permission evidence on offline capture", async () => {
 const data = form(); data.set("source", "WHATSAPP"); data.set("permissionEvidence", "Customer requested a callback in the conversation");
 expect((await captureManualEnquiry({ status: "idle" }, data)).status).toBe("success");
 expect(save.mock.calls[0][0]).toMatchObject({ source: "WHATSAPP", consentVersion: "staff-recorded-v1" });
 expect(save.mock.calls[0][1]).toBe("staff");
});
it("denies finance manual capture before saving", async () => {
 staff.mockResolvedValue({ id: "finance", role: "CUSTOMER", staffRole: "FINANCE", isActive: true });
 expect((await captureManualEnquiry({ status: "idle" }, form())).status).toBe("error");
 expect(save).not.toHaveBeenCalled();
});
it("does not report success or expose sensitive database errors on persistence failure", async () => {
 save.mockRejectedValue(new Error("sensitive database failure"));
 const result = await submitServiceEnquiry({ status: "idle" }, form());
 expect(result.status).toBe("error"); expect(result.reference).toBeUndefined(); expect(JSON.stringify(result)).not.toContain("sensitive");
});
