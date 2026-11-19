import type { NextConfig } from "next";

/**
 * Security headers (Step 18) and image policy (Step 19).
 *
 * No Content-Security-Policy yet, deliberately. A CSP that has to allow
 * Next's inline hydration scripts needs per-request nonces threaded through
 * the proxy, and a half-configured CSP that everyone learns to ignore is
 * worse than none. Add it as one deliberate task before launch — see the
 * deployment checklist in README.
 */
const securityHeaders = [
  // Don't let browsers second-guess a declared content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No framing: this app has no legitimate embed use, and clickjacking a
  // booking confirm button is a real attack.
  { key: "X-Frame-Options", value: "DENY" },
  // Send the origin to other sites, the full path only to ourselves — keeps
  // booking references out of third-party referer logs.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here needs these.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=(self)",
  },
  // HSTS. Two years, subdomains included. Harmless on localhost (browsers
  // ignore it over http) and required in production.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // The VPS image (Dockerfile) builds a self-contained server; Vercel builds
  // as usual. See docs/VPS_DEPLOYMENT.md.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,

  async headers() {
    return [
      {
        // Everything except the payment return, which opens inside Pesapal's frame.
        source: "/:path((?!payments/return).*)",
        headers: securityHeaders,
      },
      {
        // Pesapal's embedded page sends the customer back here inside its frame;
        // only Pesapal may frame it, and the page itself breaks out to the top window.
        source: "/payments/return",
        headers: [
          ...securityHeaders.filter((h) => h.key !== "X-Frame-Options"),
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://pay.pesapal.com https://cybqa.pesapal.com",
          },
        ],
      },
      {
        // Our own footage and photographs never change under the same name
        // (add a new file, or rename, to change one), so browsers and CDNs
        // can keep them for a year and never ask again. Range requests, which
        // video playback uses, are cached by the browser the same way.
        source: "/media/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Dashboards and auth screens must never be cached by a shared proxy
        // — one customer's bookings served to another is the worst possible
        // caching bug.
        source: "/:path(account|provider|admin|staff|sign-in|sign-up)/:rest*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },

  images: {
    // Kept narrow: a wide pattern makes the optimiser an open proxy.
    remotePatterns: [
      // Placeholder photography; comes out at launch. See src/lib/images.ts.
      { protocol: "https", hostname: "images.unsplash.com" },
      // Our own cloud only, not all of res.cloudinary.com.
      ...(process.env.CLOUDINARY_CLOUD_NAME
        ? [
            {
              protocol: "https" as const,
              hostname: "res.cloudinary.com",
              pathname: `/${process.env.CLOUDINARY_CLOUD_NAME}/**`,
            },
          ]
        : []),
      ...(process.env.R2_PUBLIC_URL
        ? [
            {
              protocol: "https" as const,
              hostname: new URL(process.env.R2_PUBLIC_URL).hostname,
            },
          ]
        : []),
    ],
    formats: ["image/avif", "image/webp"],
    // Optimised copies are kept for a year rather than the 60-second default.
    minimumCacheTTL: 31536000,
  },
};

export default nextConfig;
