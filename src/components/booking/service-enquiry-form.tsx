"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import {
  submitServiceEnquiry,
  captureManualEnquiry,
} from "@/app/actions/service-enquiry";
import { type FlightEnquiryState } from "@/lib/flight-enquiry-schema";
import { SOURCES, label } from "@/lib/enquiry-workflow";
import { Button } from "@/components/ui/button";

const field =
  "mt-2 block w-full rounded-xl border border-[var(--line-strong)] bg-[var(--paper-raised)] p-3";
export function ServiceEnquiryForm({
  submissionKey,
  initialService = "GENERAL",
  context = "",
  manual = false,
  className = "",
}: {
  submissionKey: string;
  initialService?: string;
  context?: string;
  manual?: boolean;
  className?: string;
}) {
  const [state, action, pending] = useActionState(
    manual ? captureManualEnquiry : submitServiceEnquiry,
    { status: "idle" } as FlightEnquiryState,
  );
  const [service, setService] = useState(initialService);
  const [values, setValues] = useState<Record<string, string>>({
    partySize: "1",
    message: "",
    context,
  });
  const [flexible, setFlexible] = useState(false);
  const [consent, setConsent] = useState(false);
  const change = (name: string, value: string) =>
    setValues((v) => ({ ...v, [name]: value }));
  const input = (
    name: string,
    title: string,
    options: {
      type?: string;
      required?: boolean;
      maxLength?: number;
      min?: number;
      max?: number;
    } = {},
  ) => (
    <label className="block">
      {title}
      <input
        name={name}
        className={field}
        {...options}
        value={values[name] ?? ""}
        onChange={(e) => change(name, e.target.value)}
        aria-invalid={!!state.fieldErrors?.[name]}
        aria-describedby={
          state.fieldErrors?.[name] ? `${name}-error` : undefined
        }
      />
      {state.fieldErrors?.[name] && (
        <span id={`${name}-error`} className="text-sm text-red-700">
          {state.fieldErrors[name]}
        </span>
      )}
    </label>
  );
  if (state.status === "success")
    return (
      <section
        role="status"
        className="rounded-xl border border-forest-300 bg-forest-100 p-6"
      >
        <h2 className="text-2xl">Enquiry saved</h2>
        <p className="my-3 break-all font-mono">{state.reference}</p>
        <p>
          This is a request for assistance, not a booking, reservation or
          payment. Keep this reference when contacting us. Our team can review
          the saved request.
        </p>
      </section>
    );
  const services = manual
    ? ["GENERAL", "FLIGHT", "TRIP", "STAY", "TRANSPORT", "GROUP", "EVENT"]
    : ["GENERAL", "TRIP", "STAY", "TRANSPORT", "GROUP", "EVENT"];
  return (
    <form
      action={action}
      onReset={(e) => e.preventDefault()}
      className={`space-y-5 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-6 ${className}`}
    >
      <input type="hidden" name="submissionKey" value={submissionKey} />
      <input type="hidden" name="context" value={context} />
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
        <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          <p>{state.message}</p>
          <ul>
            {Object.entries(state.fieldErrors ?? {}).map(([key, value]) => (
              <li key={key}>
                {label(key)}: {value}
              </li>
            ))}
          </ul>
        </div>
      )}
      <fieldset disabled={pending} className="space-y-5">
        <legend className="mb-4 text-xl">Travel request</legend>
        <label className="block">
          Service
          <select
            name="service"
            className={field}
            value={service}
            onChange={(e) => setService(e.target.value)}
          >
            {services.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
        {!manual && (
          <p className="text-sm">
            For flights, use our{" "}
            <Link className="underline" href="/flights">
              flight quote form
            </Link>
            . Requested services are subject to staff and supplier checks;
            fulfilment is not guaranteed.
          </p>
        )}
        {service === "FLIGHT" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {input("origin", "Departure city / airport", {
              required: true,
              maxLength: 120,
            })}
            {input("destination", "Destination city / airport", {
              required: true,
              maxLength: 120,
            })}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {input("startDate", "Preferred start / departure (optional)", {
            type: "date",
          })}
          {input("endDate", "End / return (optional)", { type: "date" })}
        </div>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="flexible"
            checked={flexible}
            onChange={(e) => setFlexible(e.target.checked)}
          />
          Dates are flexible
        </label>
        {input("partySize", "Party / group size", {
          type: "number",
          required: true,
          min: 1,
          max: 500,
        })}
        {service === "TRANSPORT" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {input("pickup", "Pickup location", {
              required: true,
              maxLength: 200,
            })}
            {input("dropoff", "Drop-off location", {
              required: true,
              maxLength: 200,
            })}
          </div>
        ) : (
          <>
            <input type="hidden" name="pickup" value="" />
            <input type="hidden" name="dropoff" value="" />
          </>
        )}
        {input("location", "Destination / preferred location", {
          required: ["TRIP", "STAY", "EVENT"].includes(service),
          maxLength: 200,
        })}
        {input("organization", "Organization / group (if applicable)", {
          required: service === "GROUP",
          maxLength: 160,
        })}
        {input("budget", "Budget range and currency (optional)", {
          maxLength: 100,
        })}
        <label className="block">
          What would you like us to arrange?
          <textarea
            className={field}
            name="message"
            required
            minLength={10}
            maxLength={4000}
            rows={4}
            value={values.message ?? ""}
            onChange={(e) => change("message", e.target.value)}
          />
        </label>
        {context && (
          <p className="text-sm whitespace-pre-wrap">
            Request context: {context}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {input("name", "Contact name", { required: true, maxLength: 120 })}
          {input("phone", "Phone / WhatsApp", { type: "tel", maxLength: 40 })}
          {input("email", "Email", { type: "email", maxLength: 254 })}
          <label>
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
        </div>
        {manual && (
          <>
            <label>
              Lead source
              <select name="source" className={field}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              How permission to contact was obtained
              <textarea
                name="permissionEvidence"
                required
                minLength={10}
                maxLength={1000}
                className={field}
              />
            </label>
          </>
        )}
        <p className="text-sm">
          Do not enter passport numbers, identity documents or payment-card
          details.
        </p>
        <p>
          <Link
            href="/legal/privacy"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the privacy notice (new tab)
          </Link>
        </p>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="consent"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 size-5 shrink-0"
          />
          <span>
            {manual
              ? "I confirm the customer has given permission to be contacted and the evidence above is accurate."
              : "I have read the privacy notice and agree to be contacted about this request."}
          </span>
        </label>
      </fieldset>
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Saving…" : "Save enquiry"}
      </Button>
    </form>
  );
}
