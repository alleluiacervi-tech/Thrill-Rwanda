import { InteractionCounter } from "@/components/layout/interaction-counter";
import type { Metadata, Viewport } from "next";
import { Fraunces, Karla } from "next/font/google";
import { SiteProvider } from "@/components/layout/site-context";
import { site } from "@/lib/site";
import { getSite } from "@/lib/settings";
import "./globals.css";

/**
 * Fraunces carries the brand voice: a soft, warm old-style serif, with the
 * wonky italic kept for accent lines. Karla is the working face — a
 * grotesque with humanist warmth that pairs with Fraunces without fighting it.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const body = Karla({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

// The business name comes from Admin → Settings, so titles follow it.
export async function generateMetadata(): Promise<Metadata> {
  const { name, description } = await getSite();
  return {
  metadataBase: new URL(site.url),
  title: {
    default: `${name} — Flight quotes & Rwanda travel planning`,
    template: `%s · ${name}`,
  },
  description,
  keywords: [
    "Rwanda safari booking",
    "Kigali airport transfer",
    "car hire Rwanda",
    "gorilla trekking Rwanda",
    "Volcanoes National Park lodges",
    "Akagera safari",
  ],
  openGraph: {
    type: "website",
    locale: site.locale,
    url: site.url,
    siteName: name,
    title: `${name} — Flights & Rwanda travel`,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${name} — Flights & Rwanda travel`,
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  };
}

export const viewport: Viewport = {
  themeColor: "#1c5c45",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-RW"
      // Tells Next the smooth scroll in globals.css is intentional, so it
      // suppresses it during route transitions rather than warning.
      data-scroll-behavior="smooth"
      className={`${fraunces.variable} ${body.variable}`}
    >
      {/* Browser extensions (ColorZilla, Grammarly) add attributes to body before React hydrates. */}
      <body className="grain antialiased" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-forest-800 focus:px-5 focus:py-3 focus:text-sm focus:font-medium focus:text-bone-50 focus:shadow-[var(--shadow-float)]"
        >
          Skip to content
        </a>
        <SiteProvider value={await getSite()}><InteractionCounter />{children}</SiteProvider>
      </body>
    </html>
  );
}
