import { db } from "@/lib/db";
import { getSite } from "@/lib/settings";
import { formatDateRange, formatMoney } from "@/lib/utils";
import type { BookingStatus } from "@/generated/prisma/enums";
import { resolveBookingSubjectDetails } from "@/lib/booking-display";
import { renderEmail, sendRendered, type EmailContent } from "@/lib/email/template";
import { renderTemplate, type TemplateKey } from "@/lib/email/templates";

/**
 * Notifications (Step 15).
 *
 * Two channels, deliberately decoupled:
 *
 *   - The `notifications` table is the source of truth. It is written first
 *     and always, so a customer's dashboard shows the event even if email is
 *     down or unconfigured.
 *   - Email is best-effort on top. A failed send is logged and swallowed.
 *
 * NOTHING here may throw into a caller. A booking that succeeded must not be
 * reported as failed because an email bounced, and a status change must not
 * roll back because Resend rate-limited us. Every public function is wrapped.
 */

type Recipient = { userId: string; email: string; name: string | null };

type NotifyInput = {
  to: Recipient[];
  type: string;
  title: string;
  body: string;
  href?: string;
  /** Skip email for low-value events; the in-app row is still written. */
  emailToo?: boolean;
  /** Email-only extras; the in-app row keeps just title and body. */
  email?: Pick<EmailContent, "preheader" | "details" | "note" | "tone"> & {
    /** Set when an admin has reworded this email. */
    subject?: string;
    paragraphs?: string[];
    /** Button label for `href`. */
    cta?: string;
  };
};

async function sendEmail(to: Recipient, input: NotifyInput) {
  const { title, body, href, email } = input;
  return sendRendered(
    to.email,
    renderEmail({
      subject: email?.subject ?? title,
      preheader: email?.preheader ?? body,
      name: to.name,
      paragraphs: email?.paragraphs ?? [body],
      details: email?.details,
      cta: href ? { label: email?.cta ?? "Open your dashboard", href } : undefined,
      note: email?.note,
      tone: email?.tone,
    }, await getSite()),
  );
}

/**
 * Applies the admin's wording for this email, if they have saved one.
 *
 * The in-app notification keeps the built-in title and body: it is a short
 * dashboard line, not the email, and the two should not drift apart silently.
 */
async function withTemplate(
  input: NotifyInput,
  key: TemplateKey,
  values: Record<string, string | undefined>,
): Promise<NotifyInput> {
  const rendered = await renderTemplate(key, values);
  if (!rendered?.edited) return input;

  return {
    ...input,
    email: {
      ...input.email,
      subject: rendered.subject,
      paragraphs: rendered.paragraphs,
      cta: rendered.ctaLabel || input.email?.cta,
    },
  };
}

/** Writes in-app rows for everyone, then tries email. Never throws. */
export async function notify(input: NotifyInput) {
  const { type, title, body, href, emailToo = true } = input;
  const to = [
    ...new Map(
      input.to.map((recipient) => [recipient.userId, recipient]),
    ).values(),
  ];
  let rows: { id: string; userId: string }[] = [];
  if (to.length === 0) return;

  try {
    rows = await db.notification.createManyAndReturn({
      select: { id: true, userId: true },
      data: to.map((r) => ({
        userId: r.userId,
        type,
        title,
        body,
        href,
        channel: emailToo ? "email" : "in_app",
      })),
    });
  } catch (err) {
    console.error("[notify] failed to write notification rows", err);
  }

  if (!emailToo) return;

  const results = await Promise.allSettled(to.map((r) => sendEmail(r, input)));

  // Mark only this event's rows for the recipients whose provider call succeeded.
  // A failed recipient or an older unsent event must never inherit another send's timestamp.
  const deliveredUserIds = to
    .filter(
      (_recipient, index) =>
        results[index]?.status === "fulfilled" &&
        !(results[index] as PromiseFulfilledResult<{ skipped: boolean }>).value
          .skipped,
    )
    .map((recipient) => recipient.userId);
  const deliveredIds = rows
    .filter((row) => deliveredUserIds.includes(row.userId))
    .map((row) => row.id);
  if (deliveredIds.length) {
    try {
      await db.notification.updateMany({
        where: { id: { in: deliveredIds } },
        data: { sentAt: new Date() },
      });
    } catch {
      /* Keep the notification available even if bookkeeping fails. */
    }
  }
}

/* ------------------------------------------------------------ recipients */

async function adminRecipients(): Promise<Recipient[]> {
  const admins = await db.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true, email: true, fullName: true },
  });
  return admins.map((a) => ({ userId: a.id, email: a.email, name: a.fullName }));
}

/** The customer, the provider's owner, and every active admin. */
async function bookingParties(bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      reference: true,
      serviceType: true,
      resourceId: true,
      startDate: true,
      endDate: true,
      totalMinor: true,
      currency: true,
      guests: true,
      customer: { select: { id: true, email: true, fullName: true } },
      provider: {
        select: {
          businessName: true,
          user: { select: { id: true, email: true, fullName: true } },
        },
      },
    },
  });
  if (!booking) return null;

  const subject = (await resolveBookingSubjectDetails([booking])).get(booking.resourceId);
  // The summary table every booking email shows.
  const summary: [string, string][] = [
    ["Reference", booking.reference],
    ...(subject ? [[subject.kind, subject.title] as [string, string]] : []),
    ["Dates", formatDateRange(booking.startDate, booking.endDate)],
    ["Guests", `${booking.guests} ${booking.guests === 1 ? "guest" : "guests"}`],
    ["Total", formatMoney(booking.totalMinor, booking.currency)],
  ];

  return {
    booking,
    summary,
    listing: subject?.title ?? "your booking",
    customer: {
      userId: booking.customer.id,
      email: booking.customer.email,
      name: booking.customer.fullName,
    } satisfies Recipient,
    provider: {
      userId: booking.provider.user.id,
      email: booking.provider.user.email,
      name: booking.provider.user.fullName,
    } satisfies Recipient,
    admins: await adminRecipients(),
  };
}

/* ------------------------------------------------------- booking events */

/** Fired after a booking is created. Customer + provider + admin. */
export async function notifyBookingCreated(bookingId: string) {
  try {
    const parties = await bookingParties(bookingId);
    if (!parties) return;
    const { booking, summary, listing, customer, provider, admins } = parties;

    const dates = formatDateRange(booking.startDate, booking.endDate);
    const total = formatMoney(booking.totalMinor, booking.currency);
    // Hotel stays are settled at the property; everything else is paid online.
    const nextStep =
      booking.serviceType === "ROOM"
        ? "There's nothing to pay online — you settle with the property when you arrive."
        : "You can pay and follow progress from your booking page.";

    await Promise.all([
      notify(
        await withTemplate(
          {
        to: [customer],
        type: "booking.created",
        title: `Booking ${booking.reference} received`,
        body: `We've held your place for ${dates}. Total ${total}. We'll confirm with ${booking.provider.businessName} shortly.`,
        href: `/account/bookings/${booking.reference}`,
        email: {
          paragraphs: [
            `Thanks for booking ${listing} with us. Your dates are held while ${booking.provider.businessName} confirms availability, which usually takes a few hours.`,
            `We'll email you as soon as it's confirmed. ${nextStep}`,
          ],
          details: summary,
          cta: "View your booking",
          note: "Plans changed? Reply to this email or call us and we'll help before anything is charged.",
        },
          },
          "booking.created",
          {
            customerName: customer.name?.split(" ")[0],
            reference: booking.reference,
            listing,
            provider: booking.provider.businessName,
            dates,
            guests: `${booking.guests} ${booking.guests === 1 ? "guest" : "guests"}`,
            total,
            nextStep,
          },
        ),
      ),
      notify({
        to: [provider],
        type: "booking.new",
        title: `New booking ${booking.reference}`,
        body: `${customer.name ?? customer.email} booked ${dates} for ${booking.guests} ${booking.guests === 1 ? "guest" : "guests"}. Total ${total}. Please confirm or decline.`,
        href: `/provider/bookings`,
        email: {
          paragraphs: [
            `${customer.name ?? customer.email} has booked ${listing}. Please confirm or decline it from your dashboard so the guest isn't left waiting.`,
          ],
          details: summary,
          cta: "Review booking",
        },
      }),
      notify({
        to: admins,
        type: "booking.new.admin",
        title: `New booking ${booking.reference}`,
        body: `${customer.name ?? customer.email} → ${booking.provider.businessName}, ${dates}, ${total}.`,
        href: `/admin/bookings`,
        emailToo: false, // admins watch the dashboard; don't spam them
      }),
    ]);
  } catch (err) {
    console.error("[notify] booking.created failed", err);
  }
}

const CUSTOMER_COPY: Partial<
  Record<BookingStatus, (ref: string, provider: string) => { title: string; body: string }>
> = {
  CONFIRMED: (ref, provider) => ({
    title: `Booking ${ref} confirmed`,
    body: `${provider} has confirmed your booking. You're all set — we'll be in touch with the final details before you travel.`,
  }),
  REJECTED: (ref, provider) => ({
    title: `Booking ${ref} could not be taken`,
    body: `${provider} can't take these dates, so nothing has been charged. Reply to this email and we'll find you an alternative.`,
  }),
  CANCELLED: (ref: string) => ({
    title: `Booking ${ref} cancelled`,
    body: `This booking has been cancelled and the dates released. Any deposit will be refunded under our cancellation policy.`,
  }),
  COMPLETED: () => ({
    title: `How was it?`,
    body: `Your trip is marked complete. If you have a minute, leaving a review helps other travellers and the operator alike.`,
  }),
};

/** Fired after independent payment verification. */
export async function notifyPaymentReceived(
  bookingId: string,
  amountMinor: number,
  progress?: { paidMinor: number; totalMinor: number },
) {
  try {
    const parties = await bookingParties(bookingId);
    if (!parties) return;
    const { booking, summary, listing, customer, provider, admins } = parties;

    const amount = formatMoney(amountMinor, booking.currency);
    // A deposit says what is still owed; the final payment says the booking is settled.
    const owed = progress ? Math.max(0, progress.totalMinor - progress.paidMinor) : 0;
    const balance = formatMoney(owed, booking.currency);
    const money: [string, string][] = [
      ["Paid now", amount],
      ...(progress ? [["Paid so far", formatMoney(progress.paidMinor, booking.currency)] as [string, string]] : []),
      ["Balance due", owed > 0 ? balance : "Nothing, paid in full"],
    ];

    await Promise.all([
      notify(
        await withTemplate(
          {
        to: [customer],
        type: "payment.received",
        title: owed > 0 ? `Deposit received for ${booking.reference}` : `Payment received for ${booking.reference}`,
        body:
          owed > 0
            ? `We have your ${amount} deposit. The balance of ${balance} can be paid from your booking page before your trip.`
            : `We have your ${amount} and the booking is paid in full. ${booking.provider.businessName} will confirm the final details.`,
        href: `/account/bookings/${booking.reference}`,
        email: {
          preheader: `Receipt for ${amount} on ${booking.reference}`,
          details: [...summary, ...money],
          cta: owed > 0 ? "View booking and balance" : "View your booking",
          note: "Keep this payment confirmation with your booking records.",
        },
          },
          owed > 0 ? "payment.deposit" : "payment.full",
          {
            customerName: customer.name?.split(" ")[0],
            reference: booking.reference,
            listing,
            provider: booking.provider.businessName,
            amount,
            balance,
            total: formatMoney(booking.totalMinor, booking.currency),
          },
        ),
      ),
      notify({
        to: [provider],
        type: "payment.received.provider",
        title: owed > 0 ? `Deposit paid on ${booking.reference}` : `${booking.reference} is paid in full`,
        body: `${amount} has cleared for ${formatDateRange(booking.startDate, booking.endDate)}${owed > 0 ? ` (${balance} still to pay)` : ""}. Confirm the booking to lock it in.`,
        href: "/provider/bookings",
        email: { details: [...summary, ...money], cta: "Open your bookings" },
      }),
      notify({
        to: admins,
        type: "payment.received.admin",
        title: `Payment ${amount} — ${booking.reference}`,
        body: `Provider verified the payment for ${booking.provider.businessName}.`,
        href: "/admin/payments",
        emailToo: false,
      }),
    ]);
  } catch (err) {
    console.error("[notify] payment received failed", err);
  }
}

/** Fired after a status transition. Customer always; provider on admin actions. */
export async function notifyBookingStatusChanged(
  bookingId: string,
  status: BookingStatus,
  actor: "PROVIDER" | "ADMIN",
) {
  try {
    const parties = await bookingParties(bookingId);
    if (!parties) return;
    const { booking, summary, listing, customer, provider } = parties;

    const copy = CUSTOMER_COPY[status];
    if (!copy) return;

    const { title, body } = copy(booking.reference, booking.provider.businessName);

    const jobs = [
      notify(
        await withTemplate(
          {
            to: [customer],
            type: `booking.${status.toLowerCase()}`,
            title,
            body,
            href:
              status === "COMPLETED"
                ? `/account/bookings/${booking.reference}?review=1`
                : `/account/bookings/${booking.reference}`,
            email: {
              details: status === "COMPLETED" ? undefined : summary,
              cta: status === "COMPLETED" ? "Leave a review" : "View your booking",
              tone: status === "REJECTED" || status === "CANCELLED" ? "warning" : "default",
            },
          },
          `booking.${status.toLowerCase()}` as TemplateKey,
          {
            customerName: customer.name?.split(" ")[0],
            reference: booking.reference,
            listing,
            provider: booking.provider.businessName,
            dates: formatDateRange(booking.startDate, booking.endDate),
            total: formatMoney(booking.totalMinor, booking.currency),
          },
        ),
      ),
    ];

    // The provider already knows what they did themselves; only tell them
    // when an admin changed it underneath them.
    if (actor === "ADMIN") {
      jobs.push(
        notify({
          to: [provider],
          type: `booking.${status.toLowerCase()}.provider`,
          title: `Booking ${booking.reference} was ${status.toLowerCase()} by ${(await getSite()).name}`,
          body: `Our team changed this booking's status. Check your dashboard for the current state.`,
          href: "/provider/bookings",
          email: { details: summary, cta: "Open your bookings" },
        }),
      );
    }

    await Promise.all(jobs);
  } catch (err) {
    console.error("[notify] booking status change failed", err);
  }
}

/* ------------------------------------------------------ account events */

export async function notifyWelcome(userId: string) {
  try {
    const brand = await getSite();
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true },
    });
    if (!user) return;

    await notify(
      await withTemplate(
        {
      to: [{ userId: user.id, email: user.email, name: user.fullName }],
      type: "account.created",
      title: `Welcome to ${brand.name}`,
      body: `Your account is ready. Everything you book — safaris, stays, car hire and transfers — will live in one place under My bookings.`,
      href: "/account",
      email: {
        paragraphs: [
          "Your account is ready. Safaris, hotel stays, car hire and airport transfers you book with us will all live in one place, with your payments and receipts alongside.",
          `Every provider on ${brand.name} is checked by our team before they can take bookings. You pay a deposit to confirm and the balance later.`,
        ],
        cta: "Go to your account",
        note: "Didn't create this account? Reply to this email and we'll close it.",
      },
        },
        "account.created",
        { customerName: user.fullName?.split(" ")[0], siteName: brand.name },
      ),
    );

    await notify({
      to: await adminRecipients(),
      type: "account.created.admin",
      title: "New customer registered",
      body: `${user.fullName} (${user.email}) created an account.`,
      href: "/admin/users",
      emailToo: false,
    });
  } catch (err) {
    console.error("[notify] welcome failed", err);
  }
}

export async function notifyProviderStatus(
  providerId: string,
  status: "VERIFIED" | "REJECTED" | "SUSPENDED",
) {
  try {
    const provider = await db.provider.findUnique({
      where: { id: providerId },
      select: {
        businessName: true,
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!provider) return;

    const copy = {
      VERIFIED: {
        title: "You're verified",
        body: `${provider.businessName} is approved. Your listings can go live and you'll start receiving bookings.`,
      },
      REJECTED: {
        title: "We couldn't approve your application",
        body: `Something in the verification didn't check out. Get in touch — most issues are fixable.`,
      },
      SUSPENDED: {
        title: "Your account has been suspended",
        body: `Your listings are hidden and new bookings are paused. Contact us to resolve this.`,
      },
    }[status];

    await notify({
      to: [
        {
          userId: provider.user.id,
          email: provider.user.email,
          name: provider.user.fullName,
        },
      ],
      type: `provider.${status.toLowerCase()}`,
      title: copy.title,
      body: copy.body,
      href: "/provider",
      email: {
        cta: status === "VERIFIED" ? "Add your first listing" : "Open provider portal",
        tone: status === "VERIFIED" ? "default" : "warning",
      },
    });
  } catch (err) {
    console.error("[notify] provider status failed", err);
  }
}

/* --------------------------------------------------------------- reading */

export async function unreadCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

/**
 * A new provider application arrived. Confirms to the applicant that it is
 * pending (so they don't wonder why their dashboard is empty), and tells
 * admins there is something to review.
 */
export async function notifyProviderApplication(providerId: string) {
  try {
    const provider = await db.provider.findUnique({
      where: { id: providerId },
      select: {
        businessName: true,
        kind: true,
        city: true,
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!provider) return;

    const trade = provider.kind === "CAR" ? "fleet" : provider.kind === "HOTEL" ? "property" : "tours";

    await Promise.all([
      notify({
        to: [
          {
            userId: provider.user.id,
            email: provider.user.email,
            name: provider.user.fullName,
          },
        ],
        type: "provider.applied",
        title: "Application received",
        body: `Thanks — we have your application for ${provider.businessName}. Our team verifies your licence and insurance before your ${trade} can go live, usually within two weeks. You can browse and book as a customer in the meantime.`,
        href: "/provider/pending",
        email: { cta: "Check application status" },
      }),
      notify({
        to: await adminRecipients(),
        type: "provider.applied.admin",
        title: `New provider application: ${provider.businessName}`,
        body: `${provider.kind} provider in ${provider.city ?? "—"} — ${provider.user.email}. Awaiting verification.`,
        href: "/admin/providers",
        emailToo: false,
      }),
    ]);
  } catch (err) {
    console.error("[notify] provider application failed", err);
  }
}

/**
 * A provider put a listing live. Admins don't approve listings, so this is
 * how they find out something new is public — in-app only, with a link
 * straight to the page a customer now sees.
 */
export async function notifyListingPublished(
  kind: "TOUR" | "HOTEL" | "VEHICLE" | "ROOM",
  id: string,
) {
  try {
    const found =
      kind === "TOUR"
        ? await db.tour.findUnique({
            where: { id },
            select: { name: true, slug: true, provider: { select: { businessName: true } } },
          })
        : kind === "VEHICLE"
          ? await db.vehicle.findUnique({
              where: { id },
              select: { make: true, model: true, year: true, slug: true, provider: { select: { businessName: true } } },
            })
          : kind === "HOTEL"
            ? await db.hotel.findUnique({
                where: { id },
                select: { name: true, slug: true, provider: { select: { businessName: true } } },
              })
            : await db.room.findUnique({
                where: { id },
                select: { name: true, hotel: { select: { name: true, slug: true, provider: { select: { businessName: true } } } } },
              });
    if (!found) return;

    // Each kind names itself differently; a room is sold under its hotel.
    const detail =
      kind === "TOUR"
        ? { label: "Safari", name: (found as { name: string }).name, href: `/tours/${(found as { slug: string }).slug}` }
        : kind === "VEHICLE"
          ? (() => {
              const v = found as { make: string; model: string; year: number; slug: string };
              return { label: "Vehicle", name: `${v.make} ${v.model} (${v.year})`, href: `/cars/${v.slug}` };
            })()
          : kind === "HOTEL"
            ? { label: "Property", name: (found as { name: string }).name, href: `/hotels/${(found as { slug: string }).slug}` }
            : (() => {
                const r = found as { name: string; hotel: { name: string; slug: string } };
                return { label: "Room", name: `${r.hotel.name} — ${r.name}`, href: `/hotels/${r.hotel.slug}` };
              })();

    const provider =
      kind === "ROOM"
        ? (found as { hotel: { provider: { businessName: string } } }).hotel.provider.businessName
        : (found as { provider: { businessName: string } }).provider.businessName;

    await notify({
      to: await adminRecipients(),
      type: "listing.published",
      title: `${detail.label} published: ${detail.name}`,
      body: `${provider} made this live. It is bookable now — unpublish it from Admin → Listings if it shouldn't be.`,
      href: detail.href,
      emailToo: false,
    });
  } catch (err) {
    console.error("[notify] listing published failed", err);
  }
}
