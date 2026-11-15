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

/** Primary navigation — mirrors the live site's information architecture. */
/** `blurb` is the one line under each item in the phone menu. */
export const primaryNav = [
  { label: "Tours & Safaris", href: "/tours", blurb: "Gorillas, chimpanzees and the Big Five" },
  { label: "Hotels", href: "/hotels", blurb: "Lodges, lakeside stays and city suites" },
  { label: "Car Hire", href: "/cars", blurb: "4x4s and executive cars for the road ahead" },
  { label: "Airport Transfers", href: "/transfers", blurb: "To and from Kigali International Airport" },
  { label: "Corporate & Events", href: "/corporate", blurb: "Retreats, conferences and group travel" },
] as const;

export const footerNav = {
  Explore: [
    { label: "Tours & Safaris", href: "/tours" },
    { label: "Hotels & Concierge", href: "/hotels" },
    { label: "Car Hire", href: "/cars" },
    { label: "Airport Transfers", href: "/transfers" },
    { label: "Corporate & Events", href: "/corporate" },
  ],
  Company: [
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
