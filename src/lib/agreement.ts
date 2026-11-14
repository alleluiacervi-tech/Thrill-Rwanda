import { cache } from "react";
import { db } from "@/lib/db";

/**
 * The car hire agreement a customer signs.
 *
 * The wording is the client's, edited in the admin and stored like the other
 * legal documents. This module only fills in the booking's details and tells
 * the caller which version it used, so the signed copy can be kept exactly as
 * it was shown.
 */

export const AGREEMENT_SLUG = "car-hire-agreement";

export type AgreementField = { token: string; describes: string };

export const AGREEMENT_FIELDS: AgreementField[] = [
  { token: "{customerName}", describes: "The hirer's full name" },
  { token: "{customerEmail}", describes: "Their email" },
  { token: "{customerPhone}", describes: "Their phone" },
  { token: "{reference}", describes: "Booking reference" },
  { token: "{vehicle}", describes: "Make, model and year" },
  { token: "{dates}", describes: "Hire period" },
  { token: "{days}", describes: "Number of days" },
  { token: "{total}", describes: "Hire total" },
  { token: "{driver}", describes: "With a driver, or self-drive" },
  { token: "{liability}", describes: "Damage liability for this vehicle" },
  { token: "{owner}", describes: "Who owns and lets the vehicle, with the company's contacts" },
  { token: "{provider}", describes: "The fleet owner" },
  { token: "{company}", describes: "The company's registered name" },
  { token: "{companyContact}", describes: "The company's address, phone and email" },
  { token: "{today}", describes: "Today's date" },
];

/**
 * The company's Vehicle Lease Agreement, built from the client's own document.
 * An admin can still replace the wording in Admin → Legal pages.
 */
export const DEFAULT_AGREEMENT = `Vehicle Lease Agreement

Agreement number: {reference}
Date: {today}

1. Parties

The Owner: {owner}.

The Hirer: {customerName}, {customerEmail}, {customerPhone}.

Copies of the Hirer's national ID or passport and driving licence are uploaded with this booking. The originals are checked at collection.

2. Vehicle and hire details

Vehicle: {vehicle}
Hire period: {dates} ({days} days)
Driver: {driver}
Total hire charge: {total}

Registration number, mileage out and fuel level are recorded on the handover checklist at collection.

3. Damage liability

{liability}

This applies to each incident and is in addition to any amount the insurer does not cover.

4. Authorised drivers

Only the Hirer and any additional drivers approved in writing by the Owner may drive the vehicle. Each must hold a valid driving licence held for at least two years. Driving by anyone else voids the insurance, and the Hirer is fully liable for any loss or damage.

Where the hire is with a driver, the vehicle is driven only by the Owner's driver, and the Hirer agrees not to ask them to break traffic law or exceed their working hours.

5. Use of the vehicle

The vehicle may not be used for any illegal purpose, racing, towing, overloading, carrying passengers or goods for hire, driving off-road where it is not suited, or driving under the influence of alcohol or drugs.

The vehicle may not leave Rwanda without the Owner's written consent and the cross-border documents the Owner provides.

No smoking in the vehicle. No pets without the Owner's consent. The vehicle may not be sublet or lent to anyone.

Any mileage limit is as stated in the vehicle's listing. Kilometres beyond it are charged at the Owner's published rate.

The vehicle may be fitted with GPS tracking for its security. The Hirer consents to its location being recorded during the hire, used only for that purpose and handled under the Data Protection Act, 2019.

6. Payment and security deposit

The hire charge is paid as set out in the booking. Where the Owner takes a refundable security deposit, it is collected at handover and refunded within 7 days of the vehicle's return, less any unpaid charges, fines, fuel, cleaning or damage within the Hirer's liability.

7. Insurance and accidents

The vehicle is insured by the Owner as required by Rwandan law. The insurance does not cover the Hirer's personal belongings, tyres, windscreen, undercarriage, lost keys, or damage caused while breaching this agreement.

In an accident the Hirer must inform the Owner immediately, report to the police within 24 hours and obtain a police abstract, take photographs, and not admit liability to any third party.

Breakdowns must be reported to the Owner straight away. The Hirer must not arrange repairs without the Owner's approval.

8. Fuel, fines and tolls

The vehicle is returned with the same fuel level as at collection, or the shortfall is charged. Traffic fines, parking charges and tolls during the hire are the Hirer's responsibility.

9. Return of the vehicle

The vehicle is returned on the agreed date, time and place, clean, with all accessories and documents. A cleaning charge applies if it is returned unreasonably dirty.

Late return beyond a one-hour grace period is charged at the daily rate for each day or part of a day. Keeping the vehicle without the Owner's agreement may be reported to the police as unauthorised retention.

An extension needs at least 24 hours' notice and payment in advance. The Owner may recover the vehicle at the Hirer's cost if this agreement is seriously breached.

10. Handover and return checklist

At collection and at return the Owner and the Hirer together record: mileage, fuel level, cleanliness, spare wheel, jack and tools, logbook and insurance copy, fire extinguisher, first aid kit, and any existing scratches, dents or damage, with photographs. Both sign the checklist each time.

11. Cancellation

Cancellation follows the company's Cancellation Policy, published on its website.

12. Disputes and law

This agreement is governed by the laws of Rwanda. The parties will first try to settle any dispute by mediation, and otherwise through the Rwandan courts.

13. Whole agreement

This agreement, the booking and the company's Terms and Conditions are the whole agreement between the parties. If any clause is found invalid, the rest remains in force.

14. Electronic signature

The Hirer agrees that signing this agreement electronically is as binding as a handwritten signature. A copy is kept with the booking and is available to the Hirer at any time.

Declaration

I, the Hirer, confirm that I hold a valid driving licence, that I have read and understood this agreement, and that I agree to all its terms. The Owner's authorised officer signs and stamps this agreement at handover.`;

export type FilledAgreement = {
  version: number;
  /** The body with every detail filled in, exactly as the customer will see it. */
  body: string;
  /** False while the built-in draft is still in use. */
  published: boolean;
};

/** Replaces the details a caller supplies and leaves anything unknown visible. */
function fill(text: string, values: Record<string, string | undefined>) {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole);
}

export const buildAgreement = cache(
  async (values: Record<string, string | undefined>): Promise<FilledAgreement> => {
    try {
      const row = await db.legalDocument.findUnique({ where: { slug: AGREEMENT_SLUG } });
      if (row) {
        return { version: row.version, body: fill(row.body, values), published: true };
      }
    } catch (err) {
      console.error("[agreement] read failed, using the draft", err);
    }

    return { version: 0, body: fill(DEFAULT_AGREEMENT, values), published: false };
  },
);

/** Paragraphs and headings, the same way the legal pages read their text. */
export function agreementBlocks(body: string) {
  return body
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((text) => {
      const oneLine = !text.includes("\n");
      const heading = oneLine && text.length < 60 && !/[.!?]$/.test(text);
      return { kind: heading ? ("heading" as const) : ("paragraph" as const), text };
    });
}
