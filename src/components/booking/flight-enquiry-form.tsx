"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { submitFlightEnquiry } from "@/app/actions/flight-enquiry";
import {
  ENQUIRY_CONSENT_TEXT,
  type FlightEnquiryState,
} from "@/lib/flight-enquiry-schema";
import { Button } from "@/components/ui/button";

const field =
  "mt-2 block w-full rounded-xl border border-[var(--line-strong)] bg-[var(--paper-raised)] px-4 py-3 text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-forest-700";
const initial: FlightEnquiryState = { status: "idle" };

export function FlightEnquiryForm({
  submissionKey,
  today,
}: {
  submissionKey: string;
  today: string;
}) {
  const [state, action, pending] = useActionState(submitFlightEnquiry, initial);
  const [tripType, setTripType] = useState("RETURN");
  // Controlled values survive server validation and network failures so retrying
  // never submits an unexpectedly reset form under the same idempotency key.
  const [values, setValues] = useState<Record<string, string>>({});
  const [flexible, setFlexible] = useState(false);
  const [consent, setConsent] = useState(false);
  const change = (name: string, value: string) =>
    setValues((previous) => ({ ...previous, [name]: value }));
  const error = (name: string) => state.fieldErrors?.[name];
  const a11y = (name: string) => ({
    "aria-invalid": !!error(name),
    "aria-describedby": error(name) ? `${name}-error` : undefined,
  });
  const message = (name: string) =>
    error(name) ? (
      <span id={`${name}-error`} className="mt-1 block text-sm text-red-700">
        {error(name)}
      </span>
    ) : null;
  const input = (
    name: string,
    label: string,
    options: {
      type?: string;
      required?: boolean;
      maxLength?: number;
      min?: string | number;
      max?: number;
      defaultValue?: string | number;
      autoComplete?: string;
    } = {},
  ) => {
    const { defaultValue, ...attributes } = options;
    return (
      <label className="block text-sm font-medium">
        {label}
        <input
          className={field}
          name={name}
          {...attributes}
          {...a11y(name)}
          value={values[name] ?? defaultValue ?? ""}
          onChange={(e) => change(name, e.target.value)}
        />
        {message(name)}
      </label>
    );
  };

  if (state.status === "success")
    return (
      <section
        role="status"
        className="rounded-2xl border border-forest-300 bg-forest-100 p-8"
      >
        <h2 className="text-2xl">Your flight request is saved</h2>
        <p className="mt-4">Your enquiry reference</p>
        <p className="mt-2 break-all font-mono font-semibold">
          {state.reference}
        </p>
        <p className="mt-5">
          Our team can now review your request. This is an enquiry, not a
          booking or a fare hold. Price and availability must be checked before
          we send a written quote.
        </p>
        <p className="mt-3">
          Keep this reference when contacting us. No ticket has been issued and
          no payment has been taken.
        </p>
      </section>
    );

  return (
    <form
      action={action}
      onReset={(event) => event.preventDefault()}
      className="space-y-7 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-6 sm:p-8"
    >
      <input type="hidden" name="submissionKey" value={submissionKey} />
      <div hidden aria-hidden="true">
        <label>
          Website
          <input
            name="website"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
      </div>
      {state.status === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          {state.message}
        </div>
      )}
      <fieldset className="space-y-4">
        <legend className="mb-4 text-xl font-semibold">Your journey</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {input("origin", "From — city or airport", {
            required: true,
            maxLength: 120,
          })}
          {input("destination", "To — city or airport", {
            required: true,
            maxLength: 120,
          })}
        </div>
        <label className="block text-sm font-medium">
          Trip type
          <select
            name="tripType"
            value={tripType}
            onChange={(e) => setTripType(e.target.value)}
            className={field}
          >
            <option value="RETURN">Return</option>
            <option value="ONE_WAY">One way</option>
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {input("departureDate", "Departure date", {
            type: "date",
            min: today,
            required: true,
          })}
          {tripType === "RETURN" ? (
            input("returnDate", "Return date", {
              type: "date",
              min: today,
              required: true,
            })
          ) : (
            <input type="hidden" name="returnDate" value="" />
          )}
        </div>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="flexible"
            className="size-5"
            checked={flexible}
            onChange={(e) => setFlexible(e.target.checked)}
          />
          My dates are flexible
        </label>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="mb-4 text-xl font-semibold">
          Travellers and preferences
        </legend>
        <p className="text-sm text-[var(--ink-muted)]">
          For a group larger than 20, contact us. We will check age and fare
          rules when preparing your quote.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {input("adults", "Adults", {
            type: "number",
            min: 1,
            max: 20,
            required: true,
            defaultValue: 1,
          })}
          {input("children", "Children", {
            type: "number",
            min: 0,
            max: 20,
            required: true,
            defaultValue: 0,
          })}
          {input("infants", "Infants", {
            type: "number",
            min: 0,
            max: 20,
            required: true,
            defaultValue: 0,
          })}
        </div>
        <label className="block text-sm font-medium">
          Cabin preference
          <select
            className={field}
            name="cabin"
            value={values.cabin ?? "ECONOMY"}
            onChange={(e) => change("cabin", e.target.value)}
          >
            <option value="ECONOMY">Economy</option>
            <option value="PREMIUM_ECONOMY">Premium economy</option>
            <option value="BUSINESS">Business</option>
            <option value="FIRST">First</option>
          </select>
        </label>
        {input("baggage", "Baggage preferences (optional)", { maxLength: 500 })}
        <label className="block text-sm font-medium">
          Anything else? (optional)
          <textarea
            name="notes"
            value={values.notes ?? ""}
            onChange={(e) => change("notes", e.target.value)}
            maxLength={2000}
            rows={3}
            className={field}
            {...a11y("notes")}
          />
          {message("notes")}
        </label>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="mb-4 text-xl font-semibold">
          How can we reach you?
        </legend>
        {input("name", "Your name", {
          required: true,
          maxLength: 120,
          autoComplete: "name",
        })}
        {input("phone", "Phone / WhatsApp number", {
          type: "tel",
          required: true,
          maxLength: 40,
          autoComplete: "tel",
        })}
        {input("email", "Email (optional unless replying by email)", {
          type: "email",
          maxLength: 254,
          autoComplete: "email",
        })}
        <label className="block text-sm font-medium">
          Preferred reply channel
          <select
            name="replyChannel"
            className={field}
            value={values.replyChannel ?? "WHATSAPP"}
            onChange={(e) => change("replyChannel", e.target.value)}
          >
            <option value="WHATSAPP">WhatsApp</option>
            <option value="PHONE">Phone</option>
            <option value="EMAIL">Email</option>
          </select>
        </label>
      </fieldset>
      <p className="text-sm text-[var(--ink-muted)]">
        Do not send passport numbers, identity documents or payment-card details
        in this form.
      </p>
      <div>
        <p className="mb-3 text-sm">
          <Link
            className="underline"
            href="/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the privacy notice (opens a new tab)
          </Link>
        </p>
        <label className="flex items-start gap-3">
          <input
            className="mt-1 size-5 shrink-0"
            type="checkbox"
            name="consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
            {...a11y("consent")}
          />
          <span>{ENQUIRY_CONSENT_TEXT}</span>
        </label>
        {message("consent")}
      </div>
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Saving your request…" : "Request a flight quote"}
      </Button>
      <p className="text-sm text-[var(--ink-muted)]">
        An enquiry is not a booking. Fares, availability, payment instructions
        and confirmation follow staff and supplier checks.
      </p>
    </form>
  );
}
