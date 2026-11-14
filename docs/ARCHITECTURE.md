# Thrill Rwanda — Architecture

Decisions that are expensive to reverse later. Read before adding a module.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.3 (App Router, Turbopack) + React 19.2 + TypeScript |
| Styling | Tailwind v4 (CSS-first `@theme`), design tokens in `src/app/globals.css` |
| Database | PostgreSQL via Prisma 7; embedded local PostgreSQL for development, Neon or self-hosted PostgreSQL for production |
| Auth | Better Auth — sessions + role permissions |
| Payments | Pesapal — settles M-Pesa and cards through one integration |
| Email | Resend |
| Media | Cloudflare R2 |

Single Next.js app, not a split frontend/backend. The public catalogue must be
server-rendered for SEO (Step 19) and the dashboards are data-heavy; route
handlers cover the API surface without a second deployment to keep in sync.

Local development uses `npm run db:local`, which starts an embedded PostgreSQL
17 server on `127.0.0.1:54329` and persists its data in `.local-postgres/`.
The app's `DATABASE_URL` and Prisma's `DIRECT_URL` point to that local server.
Keep the server running in one terminal while using the app. Production
deployments must provide their own PostgreSQL URLs and credentials.

## The three rules

### 1. One booking table, not four

The spec presents tours, hotels, cars and transfers as four modules
(Steps 6–9) and then asks for a centralised booking engine (Step 10). They
share one lifecycle, one payment flow, one notification set and one
cancellation policy. `bookings` is therefore polymorphic:
`serviceType` + `resourceId` discriminate, and `details` (JSONB) carries the
fields only one type needs — flight number, pickup point, pickup time.

Build the booking core **before** the four product modules. Building the
modules first means writing the payment and status pipeline four times.

### 2. Availability is guarded by the database, not the application

"Check, then insert" is a race. Two concurrent requests both read
`units_booked = units_total - 1`, both pass the check, and both insert.

The `availability` table holds one row per resource per day. Prisma's schema
language cannot express CHECK constraints, so they live in their own
migration (`prisma/migrations/*_booking_constraints`) and apply automatically
with `prisma migrate`. They were originally applied out-of-band, which caused
schema drift and forced a reset — keep them in migration history:

```sql
CHECK (units_booked >= 0 AND units_booked <= units_total)
```

Every booking runs in one transaction:

1. `UPDATE availability SET units_booked = units_booked + $units`
   for every day in `[start, end)`.
2. Assert the update touched exactly `end - start` rows.
3. `INSERT` the booking.

If the CHECK fires, the transaction rolls back and the customer sees "no
longer available". This is what makes Step 20's "duplicate bookings" test
pass under real traffic.

### 3. Only a verified callback can mark a booking paid

Step 14 states it; the schema enforces it. `bookings.status` never moves to
`paid` from a client request. The gateway callback handler verifies the
transaction against the gateway API, writes `payments.status = 'succeeded'`,
and only then advances the booking. `payments.idempotencyKey` is unique, so a
replayed callback cannot double-credit.

Never trust the browser redirect. It is a UI hint, not a payment result.

## Money

All amounts are integer **minor units** (USD cents) in columns suffixed
`Minor`. No floats anywhere in the pricing path. Format only at the edge via
`formatMoney()` in `src/lib/utils.ts`. Bookings store the price agreed at
booking time and never recompute from the live listing.

## Neon connection strings

Neon issues two. Both go in `.env`:

- `DATABASE_URL` — the **pooled** string (host contains `-pooler`). Used by
  the app through the Neon adapter in `src/lib/db.ts`.
- `DIRECT_URL` — the **unpooled** string. Used by `prisma migrate` only,
  wired up in `prisma7.config.ts`.

Running migrations against the pooled endpoint will fail or hang. Running
the app against the direct endpoint will exhaust connections under load.

The Prisma client is generated to `src/generated/prisma` (gitignored, rebuilt
by the `postinstall` hook), imported as `@/generated/prisma/client`.

## Design system

Direction: *editorial safari* — deep forest ground, warm bone paper, orange
as a scalpel, with a topographic contour motif as the connective texture.

- Brand palette is in `@theme` in `globals.css`; semantic tokens (`--paper`,
  `--ink`, `--line`, `--accent`) sit on `:root`.
- Dark sections opt in with `.on-dark`, which reassigns those semantic
  tokens. Components never hard-code light or dark colours — they read
  tokens, so any component works on either ground.
- Type: **Fraunces** (display, using its SOFT/WONK/opsz axes) + **Karla**
  (body). The variable axes are the reason headings do not read as generic.
- `src/components/ui/media.tsx` renders a deterministic in-palette duotone
  for listings that have no photography yet. Pass `src` and it switches to
  `next/image` with no other call-site change.

### Motion: no opacity-0-by-default reveals

Two scroll-reveal implementations were built and measured here — a
`animation-timeline: view()` version and an IntersectionObserver version.
Both left a large share of listing cards stuck at `opacity: 0` for real
users (17 of 24 elements after a full scroll pass). On a booking site the
inventory *is* the product, so motion is confined to the hero load sequence
and to hover/focus states, neither of which can hide content. Do not
reintroduce reveals that start hidden.

## Roles

Three roles on `users.role`: `CUSTOMER`, `PROVIDER`, `ADMIN`.

A provider sees only their own listings and bookings. Every provider-scoped
query must filter on `providerId` derived from the **session**, never from a
request parameter — that is the Step 18 boundary that matters most.

## Status vocabulary

`PENDING → AWAITING_PAYMENT → PAID → CONFIRMED → COMPLETED`, with `REJECTED`
and `CANCELLED` as terminal branches. These exact values are the `BookingStatus`
enum in prisma/schema.prisma; do not add synonyms.

## Authentication (Step 3)

Better Auth 1.7 with the Prisma adapter. `User`, `Session`, `Account` and
`Verification` follow Better Auth's core shape — confirmed against
`getAuthTables()` from the installed version, not the bundled CLI, which is
older and omits `account.issuer`. Domain naming is preserved where it does
not conflict: `fullName` maps to Better Auth's `name` via `user.fields`.

Credential passwords are stored as scrypt hashes on `Account.password`,
never on `User`.

### Two rules that must not regress

**1. `role` is `input: false`.** Better Auth otherwise accepts any declared
additionalField straight from the sign-up request body, so a POST carrying
`"role": "ADMIN"` would self-promote the caller. Verified: such a request
succeeds but persists `CUSTOMER`. Role changes go through the admin
dashboard or a direct DB write.

**2. Provider scoping comes from the session.** `requireProvider()` looks up
the `Provider` row by `userId` from the session and returns its id. Every
provider-scoped query filters on that returned id. Never accept a
`providerId` from params, body or query string.

`src/proxy.ts` redirects signed-out traffic away from `/account`, `/provider`
and `/admin` before it reaches a server component. It only checks that a
session cookie exists — it validates nothing and knows no roles. The real
checks are the guards in `src/lib/session.ts`, which hit the database on
every protected render.

### Redirect loops to watch for

`/suspended` lives at the top level, deliberately outside `/account`. It was
briefly inside it, and because the account layout's guard redirects inactive
users to that page, an inactive account hit an infinite redirect. Any page a
guard redirects *to* must sit outside the layout whose guard redirects to it.

## Booking engine (Step 10)

`src/lib/booking.ts` is the only way a booking is created. Verified with a
concurrency test: 10 simultaneous requests against a 6-seat tour produced
exactly 6 bookings and 4 `UNAVAILABLE` rejections, with zero overbooked days
and held units matching successes on every day.

New bookings open in `AWAITING_PAYMENT`, not `PENDING` — the customer has
committed and the inventory is held; what's outstanding is money.

`checkAvailability()` is advisory only. It is safe to show a customer, but it
is NOT the guard — another customer can take the last unit between that read
and the write. The guarantee is the transaction plus the CHECK constraint.

### What the client is never trusted with

The booking form posts a **slug**, dates and a guest count. It does not post
a price or a database id. `submitBooking` resolves the slug to a published
resource server-side, and `createBooking` snapshots the price inside the same
transaction that holds the inventory. A tampered request cannot book a hidden
listing or choose its own total.

### Polymorphic display

`bookings.resourceId` has no foreign key, so rendering a booking needs a
lookup. `src/lib/booking-display.ts` batches that by service type — three
queries for a whole page, not one per row. A deleted listing degrades to
"Listing no longer available" rather than breaking the customer's history.

## Dates: civil dates, not instants

Booking dates are **civil dates** with no time component, stored in Postgres
`date` columns. Two rules, both of which were real bugs here:

1. **Displaying** a `@db.Date` value — format it in **UTC**
   (`formatDateRange` does). Prisma returns those as UTC midnight; formatting
   in the viewer's local zone shifts the day backwards for anyone west of
   UTC, so a customer in New York would see every booking starting a day
   early.

2. **Defaulting a date input** — build it from **local** calendar fields
   (`toLocalDateInput` / `localDatePlus` / `todayLocal`), never
   `toISOString()`. At 01:00 in Kigali (UTC+2) `toISOString()` returns
   yesterday, so the form would default to the wrong day.

The two rules pull in opposite directions because they are answering
different questions: "what day is this stored value?" versus "what day is it
where the user is sitting?"

## Windows dev note

`next dev` and `next build` share `.next`, and on Windows the second one to
start hits `EPERM: operation not permitted, rename …`, which surfaces as
unexplained 500s on pages that were fine a moment ago. Stop the dev server
and delete `.next` before building, and after building before running dev
again. A Turbopack worker panic (`exit code 0xc0000142`) has the same cure.

## Dashboards (Steps 12–13)

### The status state machine

`ALLOWED` in `src/lib/booking.ts` is the single source of truth for who may
move a booking where. Both dashboards render their buttons from
`allowedTransitions()`, so the UI can never offer an action the server would
refuse — and `transitionBooking()` re-checks inside the transaction anyway,
so two operators acting at once can't both succeed.

Provider: confirm, decline, mark complete.
Admin: those plus cancel.

**REJECTED and CANCELLED are deliberately distinct.** Rejected means the
provider couldn't take the work; cancelled means the trip was called off.
Collapsing them would make the Step 13 reports useless. Both release
inventory; COMPLETED does not, because those units were genuinely consumed.

### Provider scoping

Every action in `src/app/actions/provider.ts` re-derives `providerId` from
the session and scopes its write on it. The shape to copy:

```ts
const { providerId } = await requireProvider();
const { count } = await db.tour.updateMany({ where: { id, providerId }, data });
if (count === 0) return fail("That listing isn't yours to change.");
```

`updateMany` + a count check is what turns a cross-provider attempt into
"not found" instead of a successful write. Verified: a provider given
another provider's booking reference gets `NOT_FOUND` and the target row is
unchanged.

### Two admin invariants

1. **An admin cannot deactivate or demote themselves.** Locking the last
   admin out has no in-app fix.
2. **Suspending or rejecting a provider unpublishes every listing they
   have**, in the same transaction as the status change. A suspension that
   left listings bookable would only be a label.

Approval is also what grants the `PROVIDER` role — sign-up cannot, by
design (see the auth section).

### Narrow tables

`TableShell` defaults to a 46rem minimum width, which is right for the wide
tables and wrong inside a half-width column — the last columns end up in the
horizontal scroll where nobody finds them. Pass `dense` for two- or
three-column tables in a split layout.

## Payments — Pesapal (Step 14)

Pesapal API 3.0, no SDK: `src/lib/pesapal.ts` is four JSON endpoints behind a
bearer token cached for four of its five minutes. `src/lib/payments.ts` is the
only place a booking is allowed to become `PAID`.

### The flow

1. The customer presses Pay on their booking. `beginPayment` resolves the
   booking from the reference **and the session user** — the id never comes
   off the form — and `startCheckout` calls `SubmitOrderRequest`.
2. A `payments` row is written `INITIATED`, carrying Pesapal's
   `order_tracking_id` as `transactionId` and our per-attempt merchant
   reference as `idempotencyKey`.
3. The customer pays on Pesapal's hosted page. We never see a card or a PIN.
4. Pesapal POSTs `/api/payments/pesapal/ipn`. It also bounces the browser back
   to `/payments/return`.

Both of those land in `reconcilePayment()`, which **ignores what the
notification claims happened** and calls `GetTransactionStatus` itself. A
forged IPN for a tracking id we never issued writes nothing.

### Why the booking update is an updateMany

The IPN and the return redirect race constantly — the customer's browser is
often faster than the callback. The booking move is
`updateMany({ where: { id, status: { in: PAYABLE } } })`, so the loser of that
race matches zero rows instead of stamping `PAID` over a status that has since
moved on. `notifyPaymentReceived` fires only for the writer that actually
moved it.

Partial payments fall out of the same design: the move happens when the **sum**
of `SUCCEEDED` rows reaches `totalMinor`, not when any one payment succeeds.
The amount recorded is the gateway's figure, not ours, so a short payment reads
as short in the ledger rather than as paid in full.

### Setup, per environment

`PESAPAL_ENV` picks the endpoint — `sandbox` or `live`. Getting it backwards
charges real cards. Then register the IPN URL once and paste the id it prints
into `PESAPAL_IPN_ID`:

```
npm run pesapal:ipn                                            list what exists
npm run pesapal:ipn -- https://host/api/payments/pesapal/ipn   register one
```

Pesapal must be able to reach both that URL and `NEXT_PUBLIC_SITE_URL` over
public HTTPS — localhost registers fine and then never fires, so use a tunnel
hostname in development. Until `PESAPAL_IPN_ID` is set the booking page hides
the Pay button and shows the phone number instead, rather than opening
checkouts nothing will ever confirm.

## Notifications (Step 15)

Two channels, deliberately decoupled:

- The `notifications` table is the source of truth. Written first and
  always, so a customer's dashboard shows the event even when email is down
  or unconfigured.
- Email is best-effort on top. `sentAt` records what actually went out, so
  support can tell "never sent" from "sent but not received".

**Nothing in `src/lib/notifications.ts` may throw into a caller.** A booking
that succeeded must not be reported as failed because an email bounced, and
a status change must not roll back because Resend rate-limited us. Every
public function is wrapped, and every call site runs *after* its transaction
has committed.

Providers are notified of a customer's booking and of admin overrides, but
never of their own actions — nobody needs an email telling them what they
just clicked. Admins get in-app rows only (`emailToo: false`).

## Reviews (Step 16)

A review requires a `COMPLETED` booking belonging to the reviewer. The
lookup uses the reference *and* the session's `customerId`, then checks
status — that is what makes every rating on the site traceable to a real,
delivered trip. `Review.bookingId` is unique, so a double submit racing the
check still fails at the database.

New reviews land in `PENDING`. **Every public read filters
`status: "PUBLISHED"`, and those reads live in `src/lib/reviews.ts` rather
than at call sites** — keeping the filter in one module is the whole
moderation guarantee. Verified: a pending review contributes nothing to a
listing's aggregate until an admin publishes it.

Reviewer names are shown as first name plus surname initial. A review is
public; the reviewer's full name does not need to be.

## Security headers (Step 18)

Set in `next.config.ts`: `nosniff`, `X-Frame-Options: DENY`,
`strict-origin-when-cross-origin` (keeps booking references out of
third-party referer logs), a narrow `Permissions-Policy`, and HSTS.
`poweredByHeader` is off.

Dashboards and auth screens are served `private, no-store` — one customer's
bookings cached and served to another is the worst caching bug this app
could have.

**There is no Content-Security-Policy yet, deliberately.** A CSP that must
allow Next's inline hydration needs per-request nonces threaded through the
proxy; a half-configured CSP everyone learns to ignore is worse than none.
It is on the launch checklist as its own task.

`next.config.ts` image `remotePatterns` is empty until `R2_PUBLIC_URL` is
set, and then allows exactly that one host. A wide pattern turns the image
optimiser into an open proxy other sites can bill you for.

## Photography

`src/lib/images.ts` is the single map from slug to image URL. Pages and the
seed script both read it, so swapping the whole photography set is one file.

**Verify before adding.** Every id in that file was checked with a HEAD
request first — several ids taken from search results returned 404, and a
broken hero on a listing page is not something a build catches. Re-verify
when adding more.

Two rules that came out of doing this badly first:

1. **A hero overlay must be directional, not a blanket.** The first attempt
   put a full-coverage radial gradient at 70–96% opacity over the hero
   photograph; the image was invisible and only cost bandwidth. It is now a
   left-to-right scrim: heavy where the headline and search panel sit,
   clearing to the right so the photograph reads.

2. **Text over photography needs a shadow, not just a scrim.** The card
   scrim was tuned against dark savannah images and left the eyebrow and
   stat line barely legible on a bright beach shot. The scrim is now
   stronger in the bottom third *and* overlay text carries `.on-media`,
   which rides with the text so small type survives any image underneath.

The Unsplash host is allow-listed in `next.config.ts` purely for these
placeholders. Remove that entry when the client's own photography lands on
R2 — a wide remote pattern turns the image optimiser into an open proxy.

## The hero must not push the search panel below the fold

The homepage search panel is the primary conversion element. It has to be
visible without scrolling, and it briefly wasn't.

The cause: every hero dimension scaled with viewport **width** only. A wide
but short window — a 1080p screen is roughly 820px of viewport once browser
chrome and the taskbar are subtracted, and 1366x768 laptops are far shorter —
got a 120px headline, 160px of top padding and 48px gaps, which together
needed ~830px of vertical space.

Three rules now keep it on the fold:

1. **`--text-display-lg` scales with the smaller of width and height**:
   `clamp(3.25rem, min(7vw, 11.5vh), 7rem)`. Tall screens still get the big
   editorial headline (112px at 1922x1278); short ones shrink it (71px at
   1367x622) instead of overflowing.

2. **Vertical rhythm is viewport-relative, not fixed.** Top padding is
   `clamp(6.5rem, 13vh, 10rem)` — enough to clear the 96px floating header
   at any size — and the inter-block gaps are `clamp()`s on `vh`.

3. **Decoration is dropped before content.** The "Scroll to explore"
   affordance carries `.hide-when-short`, hidden under
   `@media (max-height: 860px)`.

Measured after the fix: panel fully visible with 56px clearance at 1367x622,
129px at 2133x911, 158px at 1922x1278, and the tabs on the fold at 351x760.
If you change hero copy or spacing, re-measure at a short viewport — a tall
test window will not catch this.

## Creating listings (Step 12)

`src/app/actions/listings.ts` is where providers create inventory. Two rules
hold for every listing type added here.

### 1. The calendar opens in the same transaction as the listing

`openCalendar()` in `src/lib/booking.ts` writes one `availability` row per
day for `CALENDAR_DAYS` (365). It takes a `Prisma.TransactionClient` because
it **must** run inside the listing's own transaction.

A listing with no availability rows is not merely empty — it is permanently
unbookable. `createBooking` requires a row for every day in the requested
range and reads a short count as "no longer available". Creating the listing
and opening its calendar as two separate operations means any failure
between them leaves a listing that looks live in the dashboard and can never
be booked, with nothing in the UI to explain why.

### 2. New listings are drafts

`isPublished` starts `false`. The provider checks their own work and
publishes deliberately. Verified: a draft vehicle is refused by
`createBooking` with `NOT_FOUND` (the price lookup filters on
`isPublished`), and becomes bookable the moment it is published.

### A hotel is not bookable — its rooms are

`resolveResource` in the booking action looks up a hotel`s cheapest
published room, so a property saved with no room types would appear in
search and then fail at the point of booking. `createHotel` therefore
requires at least one room type, and opens the calendar **per room**, each
with its own `quantity` as capacity — never per hotel.

### Capacity

Each type carries its own per-day cap, and that number becomes
`availability.unitsTotal`:

| Type | Capacity field |
|---|---|
| Vehicle | `quantity` — identical units in the fleet |
| Room | `quantity` — physical rooms of that type |
| Tour | `maxParticipants` — seats per departure |

### Prices

Forms take **whole shillings**; the action multiplies by 100 once,
server-side, before storing minor units. The client never sends cents.
