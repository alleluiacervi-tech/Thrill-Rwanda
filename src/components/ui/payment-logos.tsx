import { cn } from "@/lib/utils";

/**
 * Accepted-payment marks, drawn inline in each brand's colours.
 *
 * SVG rather than image files: sharp at any size, nothing extra to download,
 * and they sit on a white tile so they read the same in either theme.
 */

const FONT = "Arial, Helvetica, sans-serif";

function MPesa() {
  return (
    <svg viewBox="0 0 74 24" role="img" aria-label="M-Pesa" className="h-5 w-auto">
      <text x="0" y="18" fontFamily={FONT} fontSize="17" fontWeight="800" fill="#43B02A">
        M
        <tspan fill="#E2231A">-</tspan>
        PESA
      </text>
    </svg>
  );
}

function Airtel() {
  return (
    <svg viewBox="0 0 50 24" role="img" aria-label="Airtel Money" className="h-5 w-auto">
      <text x="0" y="16" fontFamily={FONT} fontSize="17" fontWeight="700" fill="#E40000">
        airtel
      </text>
      <text x="16" y="23" fontFamily={FONT} fontSize="6.5" fontWeight="700" fill="#E40000" letterSpacing="0.5">
        money
      </text>
    </svg>
  );
}

function Visa() {
  return (
    <svg viewBox="0 0 60 24" role="img" aria-label="Visa" className="h-5 w-auto">
      <text x="2" y="19" fontFamily={FONT} fontSize="20" fontWeight="900" fontStyle="italic" fill="#1A1F71" letterSpacing="-0.5">
        VISA
      </text>
    </svg>
  );
}

function Mastercard() {
  return (
    <svg viewBox="0 0 40 24" role="img" aria-label="Mastercard" className="h-6 w-auto">
      <circle cx="14" cy="12" r="10" fill="#EB001B" />
      <circle cx="26" cy="12" r="10" fill="#F79E1B" />
      {/* The overlap, where the two circles meet. */}
      <path d="M20 4a10 10 0 0 1 0 16a10 10 0 0 1 0-16z" fill="#FF5F00" />
    </svg>
  );
}

function Pesapal() {
  return (
    <svg viewBox="0 0 74 24" role="img" aria-label="Pesapal" className="h-5 w-auto">
      <text x="0" y="17" fontFamily={FONT} fontSize="18" fontWeight="600" fill="#1F3E77">
        pesa
        <tspan fill="#C8202F">pal</tspan>
      </text>
    </svg>
  );
}

function MtnMomo() {
  return (
    <svg viewBox="0 0 66 24" role="img" aria-label="MTN Mobile Money" className="h-5 w-auto">
      <ellipse cx="12" cy="12" rx="11.5" ry="8" fill="#FFCB05" stroke="#1D1D1B" strokeWidth="1.4" />
      <text x="12" y="15" textAnchor="middle" fontFamily={FONT} fontSize="8" fontWeight="900" fill="#1D1D1B">
        MTN
      </text>
      <text x="27" y="17" fontFamily={FONT} fontSize="14" fontWeight="800" fill="#1D1D1B" textLength="37" lengthAdjust="spacingAndGlyphs">
        MoMo
      </text>
    </svg>
  );
}

function Urubuto() {
  return (
    <svg viewBox="0 0 84 24" role="img" aria-label="UrubutoPay" className="h-5 w-auto">
      <text x="0" y="17" fontFamily={FONT} fontSize="15.5" fontWeight="800" fill="#0B4F8A" textLength="82" lengthAdjust="spacingAndGlyphs">
        urubuto
        <tspan fill="#F29100">Pay</tspan>
      </text>
    </svg>
  );
}

const MARKS = {
  urubuto: Urubuto,
  mtn: MtnMomo,
  pesapal: Pesapal,
  mpesa: MPesa,
  airtel: Airtel,
  visa: Visa,
  mastercard: Mastercard,
} as const;

export type PaymentMark = keyof typeof MARKS;

/** A row of payment marks on white tiles. */
export function PaymentLogos({
  marks = ["mpesa", "airtel", "visa", "mastercard"],
  size = "md",
  className,
}: {
  marks?: PaymentMark[];
  /** sm for the footer strip. */
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span className={cn("flex flex-wrap items-center gap-2", className)}>
      {marks.map((m) => {
        const Mark = MARKS[m];
        return (
          <span
            key={m}
            className={cn(
              "inline-flex items-center rounded-[var(--radius-inset)] border border-[var(--line)] bg-white",
              size === "sm" ? "h-7 px-2 [&_svg]:h-4" : "h-9 px-2.5",
            )}
          >
            <Mark />
          </span>
        );
      })}
    </span>
  );
}
