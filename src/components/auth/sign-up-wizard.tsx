"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Car,
  Check,
  CheckCircle2,
  UserRound,
} from "lucide-react";
import { submitSignUp, type SignUpState } from "@/app/actions/signup";
import type { AccountType } from "@/lib/account-types";
import { Field, FormError, PasswordField } from "@/components/auth/auth-fields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MIN_PASSWORD = 10;
const initial: SignUpState = { status: "idle" };

const ACCOUNT_OPTIONS: {
  value: AccountType;
  icon: React.ElementType;
  title: string;
  body: string;
}[] = [
  {
    value: "CLIENT",
    icon: UserRound,
    title: "Traveller",
    body: "Book safaris, stays, car hire and transfers.",
  },
  {
    value: "CAR",
    icon: Car,
    title: "Car provider",
    body: "List your fleet and take hire bookings.",
  },
  {
    value: "HOTEL",
    icon: Building2,
    title: "Hotel owner",
    body: "List your property and take room bookings.",
  },
];

/**
 * Multi-step sign-up.
 *
 * Every step's fields stay mounted in one <form>; completed steps are hidden
 * with `hidden` rather than unmounted. That way the browser keeps the values,
 * the whole thing posts as one FormData, and the server validates the
 * complete picture at once instead of trusting per-step state.
 *
 * The step count adapts: a traveller has 2 steps, a provider has 3, because
 * showing "step 2 of 4" and then skipping one is worse than not promising a
 * number you won't keep.
 */
export function SignUpWizard() {
  const router = useRouter();
  const [state, action, pending] = useActionState(submitSignUp, initial);

  const [type, setType] = React.useState<AccountType>("CLIENT");
  const [step, setStep] = React.useState(0);
  const [localErrors, setLocalErrors] = React.useState<Record<string, string>>({});

  const isProvider = type !== "CLIENT";
  const totalSteps = isProvider ? 3 : 2;

  const serverErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const errors = { ...serverErrors, ...localErrors };

  const formRef = React.useRef<HTMLFormElement>(null);

  /* A server-side field error is useless on a hidden step, so jump to the
     first step that actually holds a flagged field.

     Adjusted during render rather than in an effect: the step depends on the
     action result, and React's documented pattern for "derive state when an
     input changes" is a guarded setState in the render body. Doing it in an
     effect renders the wrong step first, then corrects it — a visible flash
     — and trips react-hooks/set-state-in-effect. */
  const [seenState, setSeenState] = React.useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "error" && state.fieldErrors) {
      const keys = Object.keys(state.fieldErrors);
      const personalKeys = [
        "firstName", "lastName", "email", "phone", "password", "confirm", "terms",
      ];
      if (keys.some((k) => personalKeys.includes(k))) setStep(1);
      else if (keys.length) setStep(2);
    }
  }

  // querySelector, not elements.namedItem: namedItem widens to RadioNodeList
  // once a radio group shares the form, which isn't what we're reading here.
  function field(name: string) {
    return formRef.current?.querySelector<HTMLInputElement>(
      `[name="${name}"]`,
    );
  }

  function value(name: string) {
    return field(name)?.value.trim() ?? "";
  }

  /** Client-side gate so the wizard doesn't advance past empty required fields. */
  function validateStep(current: number): boolean {
    const errs: Record<string, string> = {};

    if (current === 1) {
      if (!value("firstName")) errs.firstName = "First name is required";
      if (!value("lastName")) errs.lastName = "Last name is required";
      if (!/^\S+@\S+\.\S+$/.test(value("email"))) errs.email = "Enter a valid email address";
      if (!value("phone")) errs.phone = "Phone number is required";
      if (value("password").length < MIN_PASSWORD)
        errs.password = `Use at least ${MIN_PASSWORD} characters`;
      if (value("password") !== value("confirm"))
        errs.confirm = "Passwords don't match";
      if (!field("terms")?.checked) errs.terms = "Please accept the terms to continue";
    }

    if (current === 2) {
      if (!value("businessName")) errs.businessName = "Business name is required";
      if (!value("city")) errs.city = "City is required";
    }

    setLocalErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, totalSteps));
  }

  // Posting by hand skips React's automatic form reset, so a failed submit keeps everything typed.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < totalSteps - 1 || !validateStep(step)) return;
    const data = new FormData(e.currentTarget);
    React.startTransition(() => action(data));
  }

  function back() {
    setLocalErrors({});
    setStep((s) => Math.max(0, s - 1));
  }

  /* ----------------------------------------------------------- success */

  if (state.status === "success") {
    const providerPath = state.accountType !== "CLIENT";
    // Sign-up already signed them in, so go straight to where they belong.
    const destination = providerPath ? "/provider/pending" : "/account";
    return (
      <div className="rounded-[var(--radius-card)] border border-forest-300 bg-forest-100 p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-forest-600" />
        <h2 className="mt-5 text-2xl text-forest-900">
          {providerPath ? "Application received" : "Account created"}
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-forest-800/80">
          {providerPath
            ? "You're signed in and your business application is with our team. We verify your licence and insurance before listings go live, usually within two weeks. You can book as a traveller in the meantime."
            : "You're signed in and ready to book."}
        </p>
        <Button
          variant="accent"
          size="lg"
          className="mt-7 w-full"
          onClick={() => {
            router.push(destination);
            router.refresh();
          }}
        >
          {providerPath ? "View application status" : "Go to my account"}
        </Button>
      </div>
    );
  }

  /* ------------------------------------------------------------ steps */

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-5">
      <input type="hidden" name="accountType" value={type} />

      <Stepper current={step} total={totalSteps} />

      {state.status === "error" ? <FormError message={state.message} /> : null}

      {/* ---- Step 0: account type ---- */}
      <fieldset className={cn("space-y-2.5", step !== 0 && "hidden")}>
        <legend className="mb-2.5 text-sm font-medium">
          What would you like to do?
        </legend>

        {ACCOUNT_OPTIONS.map((opt) => {
          const active = type === opt.value;
          return (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer items-start gap-3.5 rounded-[var(--radius-card)] border p-3.5 transition-all duration-300",
                "[transition-timing-function:var(--ease-out-expo)]",
                active
                  ? "border-forest-800 bg-forest-100/60 shadow-[var(--shadow-lift)]"
                  : "border-[var(--line-strong)] hover:border-forest-800",
              )}
            >
              <input
                type="radio"
                name="accountTypeChoice"
                value={opt.value}
                checked={active}
                onChange={() => setType(opt.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
                  active
                    ? "bg-forest-800 text-bone-50"
                    : "bg-[var(--paper-sunken)] text-clay-700",
                )}
              >
                <opt.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{opt.title}</span>
                <span className="mt-0.5 block text-2xs leading-relaxed text-[var(--ink-muted)]">
                  {opt.body}
                </span>
              </span>
              {active ? (
                <Check className="mt-1 size-4 shrink-0 text-forest-700" />
              ) : null}
            </label>
          );
        })}

        {isProvider ? (
          <p className="rounded-[var(--radius-inset)] border border-clay-300 bg-clay-100 p-3.5 text-2xs leading-relaxed text-clay-900">
            Provider accounts are verified by our team before listings go live.
            You&rsquo;ll be able to book as a traveller straight away.
          </p>
        ) : null}
      </fieldset>

      {/* ---- Step 1: personal details ---- */}
      <fieldset className={cn("space-y-4", step !== 1 && "hidden")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" name="firstName" required autoComplete="given-name" error={errors.firstName} />
          <Field label="Last name" name="lastName" required autoComplete="family-name" error={errors.lastName} />
        </div>

        <Field
          label="Email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email}
        />

        <Field
          label="Phone / WhatsApp"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="+250…"
          hint="How a driver or guide reaches you on the day."
          error={errors.phone}
        />

        <PasswordField
          label="Password"
          name="password"
          required
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD} characters.`}
          error={errors.password}
        />

        <PasswordField
          label="Confirm password"
          name="confirm"
          required
          autoComplete="new-password"
          error={errors.confirm}
        />

        <div>
          <label className="flex items-start gap-3 text-sm text-[var(--ink-muted)]">
            <input
              type="checkbox"
              name="terms"
              className="mt-0.5 size-4 shrink-0 accent-forest-800"
            />
            <span>
              I agree to the{" "}
              <Link href="/legal/terms" className="link-draw text-lake-700">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" className="link-draw text-lake-700">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {errors.terms ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-2xs font-medium text-red-700">
              <AlertTriangle className="size-3" />
              {errors.terms}
            </p>
          ) : null}
        </div>
      </fieldset>

      {/* ---- Step 2: business details (providers only) ---- */}
      <fieldset className={cn("space-y-4", (!isProvider || step !== 2) && "hidden")}>
        <p className="text-sm text-[var(--ink-muted)]">
          Business details for{" "}
          <span className="font-medium text-forest-800">
            {type === "CAR" ? "Car provider" : "Hotel owner"}
          </span>
        </p>

        <Field
          label="Company / business name"
          name="businessName"
          autoComplete="organization"
          error={errors.businessName}
        />
        <Field
          label="Business registration number"
          name="registrationNumber"
          hint="Optional now — required before you're verified."
        />
        <Field label="KRA PIN / Tax ID" name="taxId" />
        <Field
          label="City"
          name="city"
          autoComplete="address-level2"
          placeholder="Kigali"
          error={errors.city}
        />
        <Field label="Address" name="address" autoComplete="street-address" />

        <label className="flex flex-col gap-1.5 text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
          {type === "CAR" ? "Describe your fleet" : "Describe your property"}
          <textarea
            name="description"
            rows={4}
            placeholder={
              type === "CAR"
                ? "How many vehicles, what types, where you operate."
                : "Where you are, how many rooms, what makes it worth booking."
            }
            className="w-full resize-y rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-[var(--paper-raised)] px-4 py-3 text-sm font-normal normal-case leading-relaxed tracking-normal text-[var(--ink)] outline-none transition-colors focus-visible:border-lake-600"
          />
        </label>
      </fieldset>

      {/* ------------------------------------------------------ controls */}
      <div className="flex flex-wrap items-center gap-3">
        {step > 0 ? (
          <Button type="button" variant="quiet" size="lg" onClick={back}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
        ) : null}

        {step < totalSteps - 1 ? (
          <Button
            key="continue"
            type="button"
            variant="accent"
            size="lg"
            className="flex-1"
            onClick={next}
          >
            Continue
          </Button>
        ) : (
          // Its own key: reusing the Continue button's element turned the Continue click into an early submit.
          <Button
            key="submit"
            type="submit"
            variant="accent"
            size="lg"
            className="flex-1"
            disabled={pending}
          >
            {pending
              ? "Creating account…"
              : isProvider
                ? "Submit application"
                : "Create account"}
          </Button>
        )}
      </div>

      <p className="text-center text-sm text-[var(--ink-muted)]">
        Already have an account?{" "}
        <Link href="/sign-in" className="link-draw font-medium text-lake-700">
          Sign in
        </Link>
      </p>
    </form>
  );
}

/* ------------------------------------------------------------- Stepper */

function Stepper({ current, total }: { current: number; total: number }) {
  return (
    <ol
      className="flex items-center gap-2"
      aria-label={`Step ${current + 1} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <li
              aria-current={active ? "step" : undefined}
              className={cn(
                "tnum grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors duration-300",
                done && "bg-forest-800 text-bone-50",
                active && "bg-sun-500 text-forest-950",
                !done && !active && "bg-[var(--paper-sunken)] text-[var(--ink-faint)]",
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
              <span className="sr-only">
                {done ? "completed" : active ? "current step" : "upcoming"}
              </span>
            </li>
            {i < total - 1 ? (
              <li
                aria-hidden
                className={cn(
                  "h-px flex-1 transition-colors duration-300",
                  done ? "bg-forest-800" : "bg-[var(--line-strong)]",
                )}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </ol>
  );
}
