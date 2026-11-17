"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight, Check, CircleCheck, ShieldCheck } from "lucide-react";
import {
  captureManualEnquiry,
  submitServiceEnquiry,
} from "@/app/actions/service-enquiry";
import { useSite } from "@/components/layout/site-context";
import { Button } from "@/components/ui/button";
import { SOURCES, label } from "@/lib/enquiry-workflow";
import { type FlightEnquiryState } from "@/lib/flight-enquiry-schema";
import {
  ADD_ONS,
  AGE_GROUPS,
  EVENT_NEEDS,
  EVENT_TYPES,
  JOURNEY_SERVICE,
  VENUE_STYLES,
  isJourneyKey,
  journeyForm,
} from "@/lib/journey-requests";
import { serviceFor } from "@/lib/launch-rules";
import { cn, todayLocal } from "@/lib/utils";

/**
 * The request form, in every door's shape.
 *
 * One form saves every enquiry (src/app/actions/service-enquiry.ts). What
 * changes is the questions: `journey` picks the wording and the extra fields,
 * so a wedding is asked about its venue and a school about its students.
 * Without a journey it is the general form, with a service chooser.
 *
 * Fields are controlled, so a failed submit returns with everything the
 * customer typed still in place.
 */

const fieldCls =
  "mt-1.5 block w-full rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-white px-3.5 py-3 text-[0.9375rem] leading-snug text-[var(--ink)] outline-none transition-[border-color,box-shadow] duration-200 focus-visible:border-forest-700 focus-visible:ring-4 focus-visible:ring-forest-100 aria-[invalid=true]:border-red-500";
const labelCls =
  "block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-faint)]";
const chipCls =
  "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--line-strong)] bg-white px-4 text-sm transition-colors duration-200 hover:border-forest-700 peer-checked:border-forest-800 peer-checked:bg-forest-800 peer-checked:text-bone-50 peer-focus-visible:ring-4 peer-focus-visible:ring-forest-100";

/** What the customer chooses between when the page has not chosen for them. */
const SERVICE_CHOICES: [value: string, text: string][] = [
  ["GENERAL", "Not sure yet"],
  ["TRIP", "A tour or trip"],
  ["STAY", "Somewhere to stay"],
  ["TRANSPORT", "Transport"],
  ["GROUP", "A group trip"],
  ["EVENT", "A wedding or event"],
];

/** The journey a service implies when no page has set one. */
const journeyOf = (service: string) =>
  service === "EVENT" ? "WEDDING" : service === "GROUP" ? "GROUP" : "";

export function ServiceEnquiryForm({
  submissionKey,
  initialService = "GENERAL",
  journey: initialJourney = "",
  context = "",
  initial,
  manual = false,
  className = "",
}: {
  submissionKey: string;
  initialService?: string;
  /** Tailors the questions; see src/lib/journey-requests.ts. Fixes the service. */
  journey?: string;
  context?: string;
  /** Answers known before the customer starts, e.g. the venue they chose. */
  initial?: Record<string, string>;
  manual?: boolean;
  className?: string;
}) {
  const site = useSite();
  const [state, action, pending] = useActionState(
    manual ? captureManualEnquiry : submitServiceEnquiry,
    { status: "idle" } as FlightEnquiryState,
  );

  // A page that names a journey has already chosen the service.
  const fixed = isJourneyKey(initialJourney);
  const [service, setService] = useState(
    fixed ? JOURNEY_SERVICE[initialJourney] : initialService,
  );
  const [journey, setJourney] = useState<string>(
    fixed ? initialJourney : journeyOf(initialService),
  );
  const copy = journeyForm(journey);

  const [values, setValues] = useState<Record<string, string>>({
    partySize: "1",
    message: "",
    location: journeyForm(fixed ? initialJourney : "").location.value ?? "",
    replyChannel: "WHATSAPP",
    ...initial,
  });
  const [flexible, setFlexible] = useState(false);
  const [consent, setConsent] = useState(false);
  const [needs, setNeeds] = useState<string[]>([]);
  const [addOns, setAddOns] = useState<string[]>([]);

  const change = (name: string, value: string) =>
    setValues((v) => ({ ...v, [name]: value }));
  const toggle = (list: string[], item: string) =>
    list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
  const error = (name: string) => state.fieldErrors?.[name];

  const chooseService = (next: string) => {
    setService(next);
    setJourney(journeyOf(next));
  };

  const school = journey === "SCHOOL";
  const students = Number(values.students) || 0;
  const chaperones = Number(values.chaperones) || 0;
  // A school's total is its students and staff; nobody should have to add them up.
  const partySize = school ? String(Math.max(1, students + chaperones)) : values.partySize;

  const text = (
    name: string,
    title: string,
    options: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <label className="block">
      <span className={labelCls}>{title}</span>
      <input
        name={name}
        className={fieldCls}
        {...options}
        value={values[name] ?? ""}
        onChange={(e) => change(name, e.target.value)}
        aria-invalid={!!error(name)}
        aria-describedby={error(name) ? `${name}-error` : undefined}
      />
      {error(name) ? (
        <span id={`${name}-error`} className="mt-1.5 block text-sm text-red-700">
          {error(name)}
        </span>
      ) : null}
    </label>
  );

  /** One-of-many, as pills. `name` is the field the choice is saved under. */
  const choices = (name: string, title: string, options: readonly string[]) => (
    <fieldset>
      <legend className={labelCls}>{title}</legend>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={values[name] === option}
              onChange={() => change(name, option)}
              className="peer sr-only"
            />
            <span className={chipCls}>{option}</span>
          </label>
        ))}
      </div>
      {error(name) ? <p className="mt-1.5 text-sm text-red-700">{error(name)}</p> : null}
    </fieldset>
  );

  /** Any-of-many, as pills. Sent as one comma-separated field. */
  const many = (
    name: string,
    title: string,
    options: readonly string[],
    chosen: string[],
    set: (next: string[]) => void,
  ) => (
    <fieldset>
      <legend className={labelCls}>{title}</legend>
      <input type="hidden" name={name} value={chosen.join(", ")} />
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option}>
            <input
              type="checkbox"
              checked={chosen.includes(option)}
              onChange={() => set(toggle(chosen, option))}
              className="peer sr-only"
            />
            <span className={chipCls}>
              <Check
                className={cn("size-3.5", chosen.includes(option) ? "block" : "hidden")}
                strokeWidth={3}
                aria-hidden
              />
              {option}
            </span>
          </label>
        ))}
      </div>
      {error(name) ? <p className="mt-1.5 text-sm text-red-700">{error(name)}</p> : null}
    </fieldset>
  );

  if (state.status === "success")
    return (
      <section
        role="status"
        className={cn(
          "overflow-hidden rounded-[var(--radius-panel)] border border-forest-300 bg-white shadow-[var(--shadow-float)]",
          className,
        )}
      >
        <div className="bg-forest-800 px-7 py-8 text-bone-50 sm:px-9">
          <CircleCheck className="size-10 text-sun-400" aria-hidden />
          <h2 className="mt-4 text-3xl text-white">
            {manual ? "Enquiry saved" : "Request received"}
          </h2>
          <p className="mt-2 text-forest-100">
            {manual
              ? "The enquiry is in the workspace for triage."
              : "Thank you. Our travel desk will review it and reply through the channel you chose."}
          </p>
        </div>
        <div className="space-y-4 px-7 py-7 sm:px-9">
          <div>
            <p className={labelCls}>Your reference</p>
            <p className="mt-1.5 break-all rounded-[var(--radius-inset)] bg-bone-100 px-4 py-3 font-mono text-sm">
              {state.reference}
            </p>
          </div>
          <p className="text-[0.9375rem] leading-relaxed text-[var(--ink-muted)]">
            This is a request for assistance, not a booking, reservation or
            payment. Keep this reference when contacting us.
          </p>
        </div>
      </section>
    );

  const open = (value: string) =>
    manual || !serviceFor(value) || site.publications[serviceFor(value)!] !== "HIDDEN";
  const services = [
    ...SERVICE_CHOICES,
    ...(manual ? ([["FLIGHT", "A flight"]] as [string, string][]) : []),
  ].filter(([value]) => open(value));
  const offered = copy.addOns.filter((item) => {
    const addOn = ADD_ONS.find((a) => a.label === item);
    return addOn && site.publications[addOn.service] !== "HIDDEN";
  });
  const today = manual ? undefined : todayLocal();

  return (
    <form
      action={action}
      // React resets a form after its action; these fields are controlled, so keep them.
      onReset={(e) => e.preventDefault()}
      className={cn(
        "overflow-hidden rounded-[var(--radius-panel)] border border-[var(--line)] bg-[var(--paper-raised)] shadow-[var(--shadow-float)]",
        className,
      )}
    >
      <input type="hidden" name="submissionKey" value={submissionKey} />
      <input type="hidden" name="context" value={context} />
      <input type="hidden" name="journey" value={journey} />
      <input type="hidden" name="partySize" value={partySize} />
      {/* Kept off-screen for people; a filled value marks an automated submission. */}
      <div hidden aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-6 py-5 sm:px-8">
        <h2 className="text-2xl leading-tight sm:text-[1.75rem]">{copy.title}</h2>
        <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-faint)]">
          <ShieldCheck className="size-4 text-forest-700" aria-hidden />
          A request, not a booking
        </p>
      </header>

      <fieldset disabled={pending} className="space-y-9 px-6 py-7 sm:px-8 sm:py-8">
        {state.status === "error" ? (
          <div
            role="alert"
            className="rounded-[var(--radius-inset)] border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          >
            <p className="font-semibold">{state.message}</p>
            {Object.keys(state.fieldErrors ?? {}).length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {Object.entries(state.fieldErrors ?? {}).map(([key, value]) => (
                  <li key={key}>
                    {label(key.replace(/([A-Z])/g, " $1"))}: {value}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {/* ------------------------------------------------------- what */}
        {fixed ? (
          <input type="hidden" name="service" value={service} />
        ) : (
          <fieldset>
            <legend className={labelCls}>What can we help with?</legend>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {services.map(([value, textLabel]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="service"
                    value={value}
                    checked={service === value}
                    onChange={() => chooseService(value)}
                    className="peer sr-only"
                  />
                  <span className={chipCls}>{textLabel}</span>
                </label>
              ))}
            </div>
            {!manual && site.publications.FLIGHT !== "HIDDEN" ? (
              <p className="mt-3 text-sm text-[var(--ink-muted)]">
                For flights, use the{" "}
                <Link className="font-medium text-forest-800 underline underline-offset-4" href="/flights">
                  flight quote form
                </Link>
                .
              </p>
            ) : null}
          </fieldset>
        )}

        {/* A group is either a school or it is not; the questions differ. */}
        {service === "GROUP" ? (
          <fieldset>
            <legend className={labelCls}>Who is travelling?</legend>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {[
                ["SCHOOL", "A school or university"],
                ["GROUP", "A team, association or family"],
              ].map(([value, textLabel]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="groupKind"
                    checked={journey === value}
                    onChange={() => setJourney(value)}
                    className="peer sr-only"
                  />
                  <span className={chipCls}>{textLabel}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {service === "EVENT" ? (
          <div className="space-y-6">
            {choices("eventType", "What are you celebrating?", EVENT_TYPES)}
            {choices("venueStyle", "The kind of venue you picture", VENUE_STYLES)}
            {many("needs", "What would you like us to arrange?", EVENT_NEEDS, needs, setNeeds)}
          </div>
        ) : (
          <>
            <input type="hidden" name="eventType" value="" />
            <input type="hidden" name="venueStyle" value="" />
            <input type="hidden" name="needs" value="" />
          </>
        )}

        {service === "FLIGHT" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {text("origin", "Departure city or airport", { required: true, maxLength: 120 })}
            {text("destination", "Destination city or airport", { required: true, maxLength: 120 })}
          </div>
        ) : null}

        {/* ------------------------------------------------------- when */}
        <div>
          <div className="grid gap-5 sm:grid-cols-2">
            {text("startDate", service === "EVENT" ? "Date of the event" : "From", {
              type: "date",
              min: today,
            })}
            {text(
              "endDate",
              service === "EVENT" ? "Last day, if more than one" : "To (optional)",
              { type: "date", min: values.startDate || today },
            )}
          </div>
          <label className="mt-3.5 flex w-fit items-center gap-3 text-[0.9375rem]">
            <input
              type="checkbox"
              name="flexible"
              checked={flexible}
              onChange={(e) => setFlexible(e.target.checked)}
              className="size-[1.125rem] accent-forest-800"
            />
            {service === "EVENT" ? "We could consider other dates" : "My dates are flexible"}
          </label>
        </div>

        {/* -------------------------------------------------------- who */}
        {service === "GROUP" ? (
          text("organization", school ? "School or university" : "Organisation or group", {
            required: true,
            maxLength: 160,
            autoComplete: "organization",
          })
        ) : (
          <input type="hidden" name="organization" value="" />
        )}

        {school ? (
          <div className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              {text("students", "Students travelling", {
                type: "number",
                required: true,
                min: 1,
                max: 2000,
                inputMode: "numeric",
              })}
              {text("chaperones", "Teachers and staff", {
                type: "number",
                min: 0,
                max: 500,
                inputMode: "numeric",
              })}
            </div>
            {choices("ageGroup", "Age group", AGE_GROUPS)}
            {text("learningFocus", "Subject or purpose of the visit (optional)", {
              maxLength: 200,
              placeholder: "Conservation, history, geography…",
            })}
          </div>
        ) : (
          <>
            <input type="hidden" name="students" value="" />
            <input type="hidden" name="chaperones" value="" />
            <input type="hidden" name="ageGroup" value="" />
            <input type="hidden" name="learningFocus" value="" />
            <label className="block sm:max-w-[14rem]">
              <span className={labelCls}>{copy.party}</span>
              <input
                type="number"
                className={fieldCls}
                required
                min={1}
                max={500}
                inputMode="numeric"
                value={values.partySize ?? ""}
                onChange={(e) => change("partySize", e.target.value)}
                aria-invalid={!!error("partySize")}
              />
              {error("partySize") ? (
                <span className="mt-1.5 block text-sm text-red-700">{error("partySize")}</span>
              ) : null}
            </label>
          </>
        )}

        {/* ------------------------------------------------------ where */}
        {service === "TRANSPORT" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {text("pickup", "Pickup location", { required: true, maxLength: 200 })}
            {text("dropoff", "Drop-off location", { required: true, maxLength: 200 })}
            <input type="hidden" name="location" value="" />
          </div>
        ) : (
          <>
            <input type="hidden" name="pickup" value="" />
            <input type="hidden" name="dropoff" value="" />
            {text("location", copy.location.label, {
              required: ["TRIP", "STAY", "EVENT"].includes(service),
              maxLength: 200,
              placeholder: copy.location.placeholder,
            })}
          </>
        )}

        {/* ------------------------------------------------------- more */}
        <label className="block">
          <span className={labelCls}>{copy.message.label}</span>
          <textarea
            className={cn(fieldCls, "resize-y leading-relaxed")}
            name="message"
            required
            minLength={10}
            maxLength={4000}
            rows={4}
            placeholder={copy.message.placeholder}
            value={values.message ?? ""}
            onChange={(e) => change("message", e.target.value)}
            aria-invalid={!!error("message")}
          />
          {error("message") ? (
            <span className="mt-1.5 block text-sm text-red-700">{error("message")}</span>
          ) : null}
        </label>

        {offered.length ? (
          <div className="rounded-[var(--radius-card)] bg-bone-100 p-5">
            {many("addOns", "Add to this request", offered, addOns, setAddOns)}
            <p className="mt-3 text-sm text-[var(--ink-muted)]">
              We check these alongside your request and return one written quote.
            </p>
          </div>
        ) : (
          <input type="hidden" name="addOns" value="" />
        )}

        {text("budget", "Budget and currency (optional)", {
          maxLength: 100,
          placeholder: "For example, USD 2,000 per person",
        })}

        {context ? (
          <p className="whitespace-pre-wrap rounded-[var(--radius-inset)] border border-dashed border-[var(--line-strong)] px-4 py-3 text-sm text-[var(--ink-muted)]">
            <span className="font-semibold text-[var(--ink)]">About: </span>
            {context}
          </p>
        ) : null}

        {/* ---------------------------------------------------- contact */}
        <div className="border-t border-[var(--line)] pt-8">
          <h3 className="text-xl">How should we reply?</h3>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {text("name", "Your name", { required: true, maxLength: 120, autoComplete: "name" })}
            {text("phone", "Phone or WhatsApp", { type: "tel", maxLength: 40, autoComplete: "tel" })}
            {text("email", "Email", { type: "email", maxLength: 254, autoComplete: "email" })}
            <fieldset>
              <legend className={labelCls}>Reply by</legend>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {[
                  ["WHATSAPP", "WhatsApp"],
                  ["PHONE", "Phone"],
                  ["EMAIL", "Email"],
                ].map(([value, textLabel]) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="replyChannel"
                      value={value}
                      checked={values.replyChannel === value}
                      onChange={() => change("replyChannel", value)}
                      className="peer sr-only"
                    />
                    <span className={chipCls}>{textLabel}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        {manual ? (
          <div className="grid gap-5 border-t border-[var(--line)] pt-8">
            <label className="block">
              <span className={labelCls}>Lead source</span>
              <select name="source" className={fieldCls}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>How permission to contact was obtained</span>
              <textarea
                name="permissionEvidence"
                required
                minLength={10}
                maxLength={1000}
                className={cn(fieldCls, "resize-y")}
              />
            </label>
          </div>
        ) : null}

        {/* ---------------------------------------------------- consent */}
        <div className="space-y-4 border-t border-[var(--line)] pt-8">
          <p className="text-sm text-[var(--ink-muted)]">
            Please do not enter passport numbers, identity documents or
            payment-card details.
          </p>
          <label className="flex items-start gap-3 text-[0.9375rem] leading-relaxed">
            <input
              type="checkbox"
              name="consent"
              required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 size-5 shrink-0 accent-forest-800"
            />
            <span>
              {manual ? (
                "I confirm the customer has given permission to be contacted and the evidence above is accurate."
              ) : (
                <>
                  I have read the{" "}
                  <Link
                    href="/legal/privacy"
                    className="font-medium text-forest-800 underline underline-offset-4"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    privacy notice
                  </Link>{" "}
                  (opens in a new tab) and agree to be contacted about this request.
                </>
              )}
            </span>
          </label>
          {error("consent") ? <p className="text-sm text-red-700">{error("consent")}</p> : null}
        </div>
      </fieldset>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] bg-bone-50 px-6 py-5 sm:px-8">
        <p className="max-w-xs text-sm text-[var(--ink-muted)]">
          Nothing is reserved or charged by sending this.
        </p>
        <Button type="submit" variant="accent" size="lg" disabled={pending}>
          {pending ? "Sending…" : manual ? "Save enquiry" : "Send request"}
          {pending ? null : <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </footer>
    </form>
  );
}
