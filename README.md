# Thrill Rwanda v1.0.3

Current Version 2 delivery work is tracked in [the phased plan and checklist](docs/V2_DELIVERY_PLAN.md), based on [the implementation audit](docs/V2_IMPLEMENTATION_AUDIT.md). The first additive slice provides guest flight enquiries at `/flights` and a protected admin inbox at `/admin/enquiries`. Enquiries are separate from the existing booking engine and do not reserve inventory or initiate payment. Phase 2 adds service-aware requests, offline capture and a scoped staff workspace at `/staff/enquiries`; administrators manage staff permissions under Users. See [Enquiry operations](docs/ENQUIRY_OPERATIONS.md). Quotation generation, lead notifications, financial ledgers and full launch alignment remain scheduled in the plan.

Rwanda-focused travel booking demo for **Thrill Rwanda**, featuring Volcanoes
National Park, Nyungwe and Akagera as destination examples. Customer, provider
and admin roles share one booking engine.

> Note: The seeded catalogue is sample material; replace it before launch.
> Legal terms, provider listings, prices and payment configuration are not
> ready for production.

Architecture decisions: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 ·
PostgreSQL · Prisma 7 · Better Auth · Pesapal (mobile money + cards) · Resend

## Getting started

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd install
npm.cmd run db:local       # keep running in this terminal
```

In a second terminal:

```powershell
npm.cmd run db:migrate
npm.cmd run dev
```

Open http://localhost:3000.

`db:local` stores database files in the ignored `.local-postgres/` directory
and listens only on localhost. Keep that command running in its own terminal
while using the app; press Ctrl+C there to stop it. `.env.example` contains
the local database settings. Payment, email, and cloud storage credentials
can stay empty during local development.

`npm run db:seed` loads a **sample** Rwanda catalogue (gorilla trekking,
Akagera, Nyungwe, Lake Kivu, Kigali) priced in USD. It is placeholder content,
not Thrill Rwanda's offer: replace it with real operators, rates and
photography before launch. If you ran the seed before the rebrand, reset the
database first (`npx prisma migrate reset`) so the old Kenya sample listings
are removed.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:local` | Start the project-local PostgreSQL server |
| `npm run db:migrate` | Create + apply a migration (dev) |
| `npm run db:deploy` | Apply migrations (CI/production) |
| `npm run db:seed` | Load the demo catalogue + 365 days of availability |
| `npm run db:studio` | Prisma Studio |

## Layout

```
prisma/
  seed.ts                demo catalogue -> Postgres + availability
  schema.prisma          data model — domain + Better Auth tables
  migrations/            init, account issuer, booking constraints
  sql/01_constraints.sql source of the constraints migration (reference copy)
src/
  app/
    actions/             server actions — booking, enquiry
    account/ provider/ admin/   role-guarded dashboards
    globals.css          design tokens, textures, motion
    tours|hotels|cars/   listing + [slug] detail routes
    legal/[slug]/        draft terms, privacy, cancellation
    sitemap.ts robots.ts
  components/
    brand/               logo
    layout/              header, footer, page shell + interior hero
    cards/               tour / hotel / vehicle / destination cards
    search/              multi-tab search panel, URL-driven filter bar
    booking/             booking panel, cancel form, transfer + enquiry forms
    ui/                  button, primitives, media
  lib/
    booking.ts           THE booking engine — create, cancel, transition, availability
    booking-display.ts   resolves polymorphic resourceId to a display subject
    auth.ts session.ts   Better Auth config + server-side role guards
    db.ts                Prisma client (local PostgreSQL or Neon adapter)
    site.ts              brand + contact details, navigation
    content.ts           demo catalogue — replace with DB queries
    utils.ts             cn(), money and date formatting
```

## Status

**Delivered** — Steps 1, 2, 4, 5, plus the public half of 6–9, 17 and 19:

- Project setup, Prisma/Neon schema, design system, homepage.
- Public catalogue: tours, hotels, car hire and transfers — listing pages
  with URL-driven filters and sort, plus detail pages with a live quote
  panel.
- About, Corporate, Contact, Become a Provider, Reviews, draft legal pages,
  a designed 404, `sitemap.xml`, `robots.txt` and JSON-LD on detail pages.
- Contact form: a real server action with Zod validation and a honeypot. It
  sends via Resend when `RESEND_API_KEY` and `EMAIL_FROM` are set; when they
  are not, it says so and points the customer to WhatsApp rather than
  faking a success.

**Step 3 — Authentication and roles.** Better Auth 1.7 on the Prisma/Neon
adapter: sign-up, sign-in, sign-out, password reset (request + set), three
roles, and dashboard shells for each. Guards live in `src/lib/session.ts`;
`src/proxy.ts` bounces signed-out traffic early but is an optimisation, not
the boundary.

Two security properties are enforced and were verified against the live
database:

- **Role escalation is impossible from the sign-up form.** `role` is declared
  `input: false` in `src/lib/auth.ts`. A sign-up POST carrying
  `"role":"ADMIN"` is accepted but persists as `CUSTOMER`. Role changes go
  through an admin or a direct DB write, nothing else.
- **Cross-role access is refused.** A signed-in customer hitting `/provider`
  or `/admin` is redirected to `/account?denied=1`. Provider-scoped queries
  take their `providerId` from `requireProvider()` — derived from the
  session, never from a request parameter.

**Step 10 — Booking engine.** One pipeline for tours, rooms and vehicles.
`npm run db:seed` loads the demo catalogue into Postgres and opens 365 days
of availability; the quote panels then create real bookings that hold real
inventory.

Verified end to end through the browser: sign up → book → three days held at
2/6 → cancel → released to 0/6, booking `CANCELLED`. And under concurrency:
10 simultaneous requests against 6 seats produced exactly 6 bookings, 4
rejections, and zero overbooked days.

The booking form posts a slug, dates and guests — never a price or a
database id. Both are resolved server-side inside the transaction.

**Steps 12–13 — Provider and admin dashboards.**

*Provider* — bookings (confirm / decline / mark complete), listings with
publish toggles, availability windows, and an editable business profile.
Scoped throughout: verified that a provider handed another provider's
booking reference gets `NOT_FOUND` and the target row is unchanged.

*Admin* — overview with the Step 13 reports (bookings by status, popular
services by volume and value, revenue, recent activity), provider
approve/reject/suspend, all bookings with status filters, all listings, and
user role/activation management.

Suspending or rejecting a provider unpublishes every listing they have in
the same transaction — verified: provider went `SUSPENDED` and all three of
their vehicles went unpublished together.

**Steps 11, 15, 16, 18 — Customer dashboard, notifications, reviews,
security headers.**

*Notifications* — in-app rows are the source of truth and are written first;
email via Resend is best-effort on top. Nothing in the notification path can
throw into a caller, so a bounced email can never fail a booking that already
holds inventory. Verified: welcome → booking created → confirmed → completed
all landed for the customer, and the provider got only the events they
didn't cause themselves.

*Reviews* — only against a `COMPLETED` booking you own, one per booking
(unique at the database). New reviews are `PENDING`; every public read
filters `PUBLISHED`. Verified: a pending review contributes nothing to a
listing's rating until an admin publishes it. Admin moderation at
`/admin/reviews` publishes, hides or deletes.

*Customer dashboard* — notifications with an unread badge, editable profile,
and the review form on completed bookings.

*Security headers* — `nosniff`, `X-Frame-Options: DENY`, referrer policy,
`Permissions-Policy`, HSTS, no `X-Powered-By`; dashboards and auth screens
served `private, no-store`. Verified against a running server.

**Not yet built** — payments (14), a full manual test pass (20), and
deployment (21). See the launch checklist below.

### Launch checklist

- [ ] **Payments (Step 14).** Needs Pesapal sandbox credentials and a public
      HTTPS callback URL. Bookings currently rest in `AWAITING_PAYMENT`.
- [ ] **Content-Security-Policy.** Deliberately not set — it needs
      per-request nonces threaded through `src/proxy.ts`. Do it as one task.
- [ ] **Legal review.** `/legal/*` are drafts and say so; a Rwandan advocate
      must review before launch.
- [ ] **Real catalogue and photography.** Replace `src/lib/content.ts` and
      pass `src` to `<Media>`.
- [ ] **Email sender domain** verified with Resend, then set `RESEND_API_KEY`
      and `EMAIL_FROM` — until both are set, email silently no-ops and the
      contact form says so.
- [ ] **Step 20 test pass** across the customer / provider / admin journeys.

Bookings open in `AWAITING_PAYMENT` and stay there: online payment is Step 14,
so the booking page tells the customer to call to settle. Transfers are still
enquiry-only — they're quoted per route rather than held as inventory.

Every internal link resolves; there are no 404s in the site chrome.

### Windows dev note

`next dev` and `next build` share `.next`. On Windows the second to start
hits `EPERM … rename`, which shows up as unexplained 500s. Stop the dev
server and delete `.next` before building, and again before going back to
dev.

### What is real vs. placeholder

- **Real:** layout, styling, filtering, sorting, routing, auth, the booking
  engine, availability, cancellation, SEO metadata, and the enquiry action.
  Bookings and inventory live in Postgres.
- **Seeded, not authored:** the catalogue itself. `src/lib/content.ts` is the
  source `npm run db:seed` loads into the database. Public pages still read
  that file for display; only booking goes through the database. Replace both
  when real listings arrive.
- **Placeholder:** listing imagery. `<Media>` renders a deterministic
  in-palette duotone; pass a `src` and it switches to `next/image` with no
  other change.
- **Not wired:** payment (Step 14). Bookings sit in `AWAITING_PAYMENT` and the
  booking page asks the customer to call to settle.
