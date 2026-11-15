/** Local-only integration check. Run: npx tsx scripts/check-flight-enquiries.ts */
import "dotenv/config";
import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { saveFlightEnquiry } from "../src/lib/flight-enquiries";
import { flightEnquirySchema } from "../src/lib/flight-enquiry-schema";

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "54329" ||
    url.pathname !== "/thrill_rwanda" ||
    process.env.NODE_ENV === "production"
  ) {
    throw new Error(
      "This check only runs against the project-local development database.",
    );
  }
  const keys: string[] = [];
  const phone = `+2507${randomInt(10000000, 99999999)}`;
  const input = () => {
    const submissionKey = randomUUID();
    keys.push(submissionKey);
    return flightEnquirySchema.parse({
      submissionKey,
      name: "Integration test",
      phone,
      email: "",
      replyChannel: "PHONE",
      origin: "Kigali",
      destination: "Nairobi",
      tripType: "ONE_WAY",
      departureDate: "2028-01-01",
      returnDate: "",
      flexible: false,
      adults: 1,
      children: 0,
      infants: 0,
      cabin: "ECONOMY",
      baggage: "",
      notes: "Local automated test",
      consent: true,
      website: "",
    });
  };
  try {
    const bookingsBefore = await db.booking.count();
    const paymentsBefore = await db.payment.count();
    const first = input();
    const retries = await Promise.all(
      Array.from({ length: 6 }, () => saveFlightEnquiry(first)),
    );
    assert.equal(new Set(retries.map((r) => r.reference)).size, 1);
    assert.equal(
      await db.enquiry.count({ where: { submissionKey: first.submissionKey } }),
      1,
    );
    await assert.rejects(
      () => saveFlightEnquiry({ ...first, destination: "London" }),
      /different details/,
    );
    const more = await Promise.allSettled(
      Array.from({ length: 6 }, () => saveFlightEnquiry(input())),
    );
    assert.equal(more.filter((r) => r.status === "fulfilled").length, 4);
    assert.equal(more.filter((r) => r.status === "rejected").length, 2);
    assert.equal(
      await db.enquiry.count({ where: { submissionKey: { in: keys } } }),
      5,
    );
    assert.equal(await db.booking.count(), bookingsBefore);
    assert.equal(await db.payment.count(), paymentsBefore);
    const saved = await db.enquiry.findUniqueOrThrow({
      where: { submissionKey: first.submissionKey },
    });
    assert.equal(saved.consentVersion, "flight-enquiry-v1");
    assert.equal(saved.email, null);
    console.log(
      "PASS: concurrent retries create one lead; changed payload rejected; concurrent contact limit enforced; consent saved; no bookings/payments created.",
    );
  } finally {
    await db.enquiry.deleteMany({ where: { submissionKey: { in: keys } } });
  }
}
main()
  .finally(() => db.$disconnect())
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
