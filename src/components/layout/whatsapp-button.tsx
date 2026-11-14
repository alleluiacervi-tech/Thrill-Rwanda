"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useSite } from "@/components/layout/site-context";

/**
 * Floating WhatsApp button on public pages.
 *
 * The message is prefilled with what the visitor is looking at, so whoever
 * answers isn't starting from "hi" with no context.
 */

const LABELS: { match: RegExp; text: (slug: string) => string }[] = [
  { match: /^\/tours\/(.+)/, text: (s) => `the ${s.replace(/-/g, " ")} safari` },
  { match: /^\/hotels\/(.+)/, text: (s) => `${s.replace(/-/g, " ")}` },
  { match: /^\/cars\/(.+)/, text: (s) => `hiring the ${s.replace(/-/g, " ")}` },
  { match: /^\/tours/, text: () => "your safaris" },
  { match: /^\/hotels/, text: () => "your hotels" },
  { match: /^\/cars/, text: () => "car hire" },
  { match: /^\/transfers/, text: () => "an airport transfer" },
  { match: /^\/partner/, text: () => "listing my business with you" },
];

function messageFor(pathname: string, siteName: string) {
  // Left open so the visitor types their company name straight after it.
  if (pathname.startsWith("/corporate")) return `Hi ${siteName}, I need a corporate rate card for `;
  for (const { match, text } of LABELS) {
    const found = pathname.match(match);
    if (found) return `Hi ${siteName}, I'd like to ask about ${text(found[1] ?? "")}.`;
  }
  return `Hi ${siteName}, I'd like to ask about a trip.`;
}

/** The page's own title reads better than its slug ("Mountain Gorilla Trekking", not "gorilla trekking volcanoes 2 day"). */
function messageFromTitle(siteName: string) {
  const title = document.title.split("·")[0]?.trim();
  return title && title !== siteName
    ? `Hi ${siteName}, I'd like to ask about ${title}.`
    : null;
}

export function WhatsAppButton() {
  const site = useSite();
  const pathname = usePathname();
  const [expanded, setExpanded] = React.useState(false);

  // Dashboards have their own chrome and a support route already.
  if (/^\/(account|provider|admin|sign-in|sign-up|reset-password|forgot-password)/.test(pathname)) {
    return null;
  }
  if (!site.contact.whatsapp) return null;

  const href = `${site.contact.whatsapp}?text=${encodeURIComponent(messageFor(pathname, site.name))}`;

  return (
    <a
      href={href}
      // Swapped in just before the link opens: document.title isn't readable during the server render.
      onPointerDown={(e) => {
        if (pathname.startsWith("/corporate")) return;
        const better = messageFromTitle(site.name);
        if (better) e.currentTarget.href = `${site.contact.whatsapp}?text=${encodeURIComponent(better)}`;
      }}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocus={() => setExpanded(true)}
      onBlur={() => setExpanded(false)}
      // Above the footer and clear of the iOS home bar; z-40 stays under the header's menus.
      className="fixed bottom-5 right-4 z-40 inline-flex h-14 items-center rounded-full bg-[#25D366] px-3 text-white shadow-[0_6px_20px_rgb(0,0,0,0.22)] transition-colors duration-300 ease-out-expo hover:bg-[#1fb855] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-800 sm:bottom-6 sm:right-6"
    >
      <WhatsAppIcon className="size-8 shrink-0 fill-current" />
      {/* Width, not display: an animated max-width slides the label out instead of popping it in. */}
      <span
        className={`overflow-hidden whitespace-nowrap text-[0.9375rem] font-semibold transition-all duration-300 ease-out-expo ${
          expanded ? "ml-2 max-w-[9rem] pr-2 opacity-100" : "ml-0 max-w-0 pr-0 opacity-0"
        }`}
      >
        Chat with us
      </span>
    </a>
  );
}

/** The WhatsApp glyph, shared by the floating button and the contact form. */
export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className ?? "size-6 fill-current"}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.174.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.896 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.945c0 2.096.549 4.142 1.595 5.945L0 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.585 0 11.946-5.36 11.949-11.945a11.87 11.87 0 00-3.421-8.4" />
    </svg>
  );
}
