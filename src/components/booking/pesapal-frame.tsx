"use client";

import * as React from "react";

/** Pesapal's hosted payment form, embedded, with dots until it has loaded. */
export function PesapalFrame({ src }: { src: string }) {
  const [loaded, setLoaded] = React.useState(false);

  return (
    <div className="relative min-h-[42rem]">
      {!loaded ? (
        <div className="absolute inset-0 grid place-items-center" aria-live="polite">
          <div className="flex flex-col items-center gap-4">
            <span className="flex gap-1.5" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <span
                  key={i}
                  className="size-2.5 animate-pulse rounded-full bg-forest-700"
                  style={{ animationDelay: `${i * 140}ms` }}
                />
              ))}
            </span>
            <span className="text-2xs text-[var(--ink-muted)]">Loading secure payment…</span>
          </div>
        </div>
      ) : null}
      <iframe
        src={src}
        title="Pesapal secure payment"
        onLoad={() => setLoaded(true)}
        className="h-[42rem] w-full border-0"
        // No sandbox: card 3-D Secure and the return to our site both need the full frame.
        allow="payment"
      />
    </div>
  );
}
