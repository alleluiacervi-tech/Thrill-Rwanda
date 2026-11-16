/**
 * Site metadata and Rwanda demo defaults.
 */

// A blank variable is treated like a missing one: Vercel lets you save an empty value, and
// new URL("") throws at build time. Falls back to the Vercel production domain, then the live site.
function siteUrl() {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  for (const candidate of [process.env.NEXT_PUBLIC_SITE_URL, vercel ? `https://${vercel}` : undefined]) {
    const value = candidate?.trim();
    if (!value) continue;
    try {
      return new URL(value).origin;
    } catch {
      // Not a usable URL; try the next one.
    }
  }
  return "http://localhost:3000";
}

export const site = {
  name: "Thrill Rwanda",
  legalName: "Thrill Rwanda",
  tagline: "Rwanda's volcanic peaks, forests and savannahs.",
  description:
    "A Rwanda-focused travel demo inspired by Volcanoes National Park, Nyungwe and Akagera. Listings, prices, contacts and payment details are sample configuration and must be verified before launch.",
  url: siteUrl(),
  locale: "en_RW",
  contact: {
    phone: "+250 786 261 104",
    phoneHref: "tel:+250786261104",
    phoneAlt: null,
    phoneAltHref: null,
    whatsapp: "https://wa.me/250786261104",
    email: "info@thrillrwanda.com",
    address: "Kigali, Rwanda",
    city: "Kigali",
    country: "Rwanda",
  },
} as const;

/**
 * Primary navigation: the five front doors, flights first. Hotels, car hire
 * and transfers are reached from the experiences panel and the footer
 * (see `essentials` in src/lib/journeys.ts).
 */
/** `blurb` is the one line under each item in the phone menu. */
export const primaryNav = [
  { label: "Flights", href: "/flights", blurb: "Request a checked written flight quote" },
  { label: "Tours & Experiences", href: "/experiences", blurb: "Private, luxury, honeymoon and city journeys" },
  { label: "Tembera u Rwanda", href: "/tembera-urwanda", blurb: "All-inclusive editions across the country" },
  { label: "Weddings & Events", href: "/weddings", blurb: "Venues reserved, guests looked after" },
  { label: "Groups & Schools", href: "/groups", blurb: "School trips, teams and associations" },
] as const;

export const footerNav = {
  Explore: [
    { label: "Request a flight quote", href: "/flights" },
    { label: "Tours & Experiences", href: "/experiences" },
    { label: "Tembera u Rwanda", href: "/tembera-urwanda" },
    { label: "Weddings & Events", href: "/weddings" },
    { label: "Groups & Schools", href: "/groups" },
    { label: "All tours & safaris", href: "/tours" },
    { label: "Hotels & stays", href: "/hotels" },
    { label: "Car hire", href: "/cars" },
    { label: "Airport transfers", href: "/transfers" },
    { label: "Corporate travel", href: "/corporate" },
  ],
  Company: [
    { label: "How it works", href: "/how-it-works" },
    { label: "Travel support", href: "/support" },
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Become a Provider", href: "/partner" },
    { label: "Reviews", href: "/reviews" },
  ],
  Account: [
    { label: "Sign In", href: "/sign-in" },
    { label: "Create Account", href: "/sign-up" },
    { label: "My Bookings", href: "/account/bookings" },
    { label: "Provider Portal", href: "/provider" },
  ],
  Legal: [
    { label: "Terms of Service", href: "/legal/terms" },
    { label: "Privacy Policy", href: "/legal/privacy" },
    { label: "Cancellation Policy", href: "/legal/cancellation" },
  ],
} as const;
