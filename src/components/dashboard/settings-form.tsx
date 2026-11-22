"use client";

import * as React from "react";
import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { updateSiteSettings, type SettingsState } from "@/app/actions/settings";
import { FormBanner, Labelled, fieldCls } from "@/components/dashboard/listing-fields";
import { Button } from "@/components/ui/button";
import { depositMinor } from "@/lib/deposit";
import { SITE_DEFAULTS, defaultHeroText } from "@/lib/site-config";
import { cn, formatMoney } from "@/lib/utils";

const initial: SettingsState = { status: "idle" };
const EXAMPLE_TOTAL = 5_850_000; // Ksh 58,500, a typical three-day safari for one.

/** What's saved; null text means "use the built-in value". */
export type SettingsValues = {
  depositPercent: number;
  damageLiabilityText: string;
  brandName: string | null;
  legalName: string | null;
  tagline: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroText: string | null;
  phone: string | null;
  phoneAlt: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  openingHours: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  xUrl: string | null;
  youtubeUrl: string | null;
  holdMinutes: number;
  transferMaxPassengers: number;
  minNoticeDays: number;
  payOnlineTours: boolean;
  payOnlineCars: boolean;
  payOnlineTransfers: boolean;
  announcement: string | null;
  announcementOn: boolean;
  heroVideo: boolean;
};

function Section({ title, lede, children }: { title: string; lede: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 border-t border-[var(--line)] pt-7 first:border-0 first:pt-0">
      <div>
        <h2 className="text-xl">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">{lede}</p>
      </div>
      {children}
    </section>
  );
}

/** A text setting: blank keeps the built-in value, shown as the placeholder. */
function Text({
  name,
  label,
  value,
  fallback,
  hint,
  type = "text",
}: {
  name: keyof SettingsValues;
  label: string;
  value: string | null;
  fallback?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <Labelled label={label} hint={hint ?? (fallback ? "Leave blank to keep the current value." : undefined)}>
      <input name={name} type={type} defaultValue={value ?? ""} placeholder={fallback} className={fieldCls} />
    </Labelled>
  );
}

function Toggle({ name, label, hint, checked }: { name: keyof SettingsValues; label: string; hint?: string; checked: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-inset)] border border-[var(--line-strong)] p-4">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-1 size-4 shrink-0 accent-forest-800" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint ? <span className="mt-0.5 block text-2xs leading-relaxed text-[var(--ink-muted)]">{hint}</span> : null}
      </span>
    </label>
  );
}

export function SettingsForm({ values }: { values: SettingsValues }) {
  const [state, action, pending] = useActionState(updateSiteSettings, initial);
  const [percent, setPercent] = React.useState(String(values.depositPercent));

  const value = Math.min(100, Math.max(1, Math.round(Number(percent) || 0)));
  const valid = Number.isFinite(Number(percent)) && Number(percent) >= 1 && Number(percent) <= 100;
  const deposit = depositMinor(EXAMPLE_TOTAL, value);

  return (
    <form
      action={action}
      className="max-w-2xl space-y-7 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-5 sm:p-7"
    >
      <FormBanner message={state.status === "error" ? state.message : undefined} />
      {state.status === "saved" ? (
        <p role="status" className="flex items-start gap-3 rounded-[var(--radius-inset)] border border-forest-300 bg-forest-100 p-4 text-sm text-forest-900">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>Saved. The whole site now shows these details; bookings already made keep what they were quoted.</span>
        </p>
      ) : null}

      <Section title="Business" lede="The name across the site, in emails and on the hire agreement.">
        <Text name="brandName" label="Business name" value={values.brandName} fallback={SITE_DEFAULTS.name} hint="Shown in the header, footer, page titles and emails." />
        <Text name="legalName" label="Registered company name" value={values.legalName} fallback={SITE_DEFAULTS.legalName} hint="As registered — used on the hire agreement, terms and footer." />
        <Text name="tagline" label="Tagline" value={values.tagline} fallback={SITE_DEFAULTS.tagline} hint="A short line, used where the site name is shown with a description." />
      </Section>

      <Section title="Homepage" lede="The headline and words at the top of the homepage.">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Filled with the wording on the site now, so there's real text to edit; emptying a box restores it. */}
          <Text name="heroTitle" label="Headline" value={values.heroTitle ?? SITE_DEFAULTS.heroTitle} fallback={SITE_DEFAULTS.heroTitle} hint="The big first line. Up to 40 characters." />
          <Text name="heroSubtitle" label="Headline second line" value={values.heroSubtitle ?? SITE_DEFAULTS.heroSubtitle} fallback={SITE_DEFAULTS.heroSubtitle} hint="Smaller, in orange. Up to 60 characters." />
        </div>
        <Labelled label="Homepage description" hint="Up to 400 characters. Empty the box to go back to the original text.">
          <textarea
            name="heroText"
            rows={3}
            maxLength={400}
            defaultValue={values.heroText ?? defaultHeroText(values.tagline ?? SITE_DEFAULTS.tagline)}
            placeholder={defaultHeroText(values.tagline ?? SITE_DEFAULTS.tagline)}
            className={cn(fieldCls, "resize-y")}
          />
        </Labelled>
      </Section>

      <Section title="Contacts" lede="Every phone link, WhatsApp button and email reply uses these.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Text name="phone" label="Main phone" value={values.phone} fallback={SITE_DEFAULTS.phone} />
          <Text name="phoneAlt" label="Second phone" value={values.phoneAlt} fallback={SITE_DEFAULTS.phoneAlt ?? ""} hint="Optional." />
          <Text name="whatsapp" label="WhatsApp number" value={values.whatsapp} fallback={SITE_DEFAULTS.whatsapp} hint="Blank uses the main phone." />
          <Text name="email" label="Email" type="email" value={values.email} fallback={SITE_DEFAULTS.email} />
        </div>
        <Text name="address" label="Office address" value={values.address} fallback={SITE_DEFAULTS.address} />
        <Text name="openingHours" label="Opening hours" value={values.openingHours} fallback="e.g. Daily, 7am – 9pm EAT" hint="Optional. Shown in the footer." />
      </Section>

      <Section title="Social links" lede="The footer shows only the ones filled in. Use the full link, starting with https://.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Text name="facebookUrl" label="Facebook" value={values.facebookUrl} fallback="https://facebook.com/…" hint=" " />
          <Text name="instagramUrl" label="Instagram" value={values.instagramUrl} fallback="https://instagram.com/…" hint=" " />
          <Text name="tiktokUrl" label="TikTok" value={values.tiktokUrl} fallback="https://tiktok.com/@…" hint=" " />
          <Text name="xUrl" label="X (Twitter)" value={values.xUrl} fallback="https://x.com/…" hint=" " />
          <Text name="youtubeUrl" label="YouTube" value={values.youtubeUrl} fallback="https://youtube.com/@…" hint=" " />
        </div>
      </Section>

      <Section title="Booking rules" lede="Apply to new bookings from the moment you save.">
        <div className="grid gap-5 sm:grid-cols-3">
          <Labelled label="Hold dates for (minutes)" hint="Unconfirmed holds are released after this.">
            <input name="holdMinutes" type="number" min={15} max={1440} required defaultValue={values.holdMinutes} className={cn(fieldCls, "tnum")} />
          </Labelled>
          <Labelled label="Transfer passengers, max" hint="Larger groups are asked to contact you.">
            <input name="transferMaxPassengers" type="number" min={1} max={40} required defaultValue={values.transferMaxPassengers} className={cn(fieldCls, "tnum")} />
          </Labelled>
          <Labelled label="Minimum notice (days)" hint="0 lets customers book for tomorrow.">
            <input name="minNoticeDays" type="number" min={0} max={60} required defaultValue={values.minNoticeDays} className={cn(fieldCls, "tnum")} />
          </Labelled>
        </div>
      </Section>

      <Section title="Booking payments" lede="Control online payment by service. Provider settings and the booking currency determine the methods offered at checkout. Hotel stays are paid at the property.">
        <div className="space-y-3">
          <Toggle name="payOnlineTours" label="Safaris and tours" checked={values.payOnlineTours} />
          <Toggle name="payOnlineCars" label="Car hire" checked={values.payOnlineCars} />
          <Toggle name="payOnlineTransfers" label="Airport transfers" checked={values.payOnlineTransfers} />
        </div>
      </Section>

      <Section title="Homepage hero" lede="The opening of the homepage. With video on, silent clips of gorillas, Lake Kivu and the crater lake play in the hero. They never play for visitors who have asked their device for reduced motion or to save data, and they pause once scrolled past. With video off, the same scenes show as still photographs.">
        <Toggle
          name="heroVideo"
          label="Play video in the homepage hero"
          hint="The website brief (section 11) recommends avoiding autoplay video on mobile connections. Switch off to show still photographs instead."
          checked={values.heroVideo}
        />
      </Section>

      <Section title="Announcement" lede="A short message across the top of every public page — holiday hours, an offer, a road closure.">
        <Text name="announcement" label="Message" value={values.announcement} fallback="e.g. Closed 25 December. WhatsApp us for urgent bookings." hint="Up to 200 characters." />
        <Toggle name="announcementOn" label="Show the announcement" checked={values.announcementOn} />
      </Section>

      <Section title="Deposit" lede="How much a customer pays at checkout to confirm a booking. They pay the balance later from their booking page. Set 100% to take payment in full.">
        <Labelled label="Deposit (% of the total)" hint="Between 1 and 100.">
          <input
            name="depositPercent"
            type="number"
            required
            min={1}
            max={100}
            step={1}
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className={cn(fieldCls, "tnum max-w-40")}
          />
        </Labelled>
        <p className="rounded-[var(--radius-inset)] bg-[var(--paper-sunken)] p-4 text-sm leading-relaxed text-[var(--ink-muted)]">
          {valid ? (
            value >= 100 ? (
              <>
                On a {formatMoney(EXAMPLE_TOTAL)} booking the customer pays{" "}
                <strong className="text-[var(--ink)]">{formatMoney(EXAMPLE_TOTAL)}</strong> at checkout.
              </>
            ) : (
              <>
                On a {formatMoney(EXAMPLE_TOTAL)} booking the customer pays{" "}
                <strong className="text-[var(--ink)]">{formatMoney(deposit)}</strong> at checkout, then{" "}
                <strong className="text-[var(--ink)]">{formatMoney(EXAMPLE_TOTAL - deposit)}</strong> later.
              </>
            )
          ) : (
            "Enter a whole number between 1 and 100."
          )}
        </p>
      </Section>

      <Section
        title="Vehicle damage liability"
        lede="Shown at car hire checkout, where the customer must tick to accept it. Each vehicle's own figure replaces {amount}, so this wording stays the same whatever the vehicle costs."
      >
        <Labelled label="Damage liability statement" hint="Must include {amount}. What the customer agreed to is stored with their booking.">
          <textarea name="damageLiabilityText" required rows={4} defaultValue={values.damageLiabilityText} className={cn(fieldCls, "resize-y leading-relaxed")} />
        </Labelled>
      </Section>

      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" variant="accent" disabled={pending || !valid}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
