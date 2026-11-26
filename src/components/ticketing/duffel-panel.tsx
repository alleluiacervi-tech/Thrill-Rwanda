"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Plane, Plug, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { addLiveFares, bookLiveFare, checkDuffel, clearLiveAttempt, payLiveHold, refreshLiveTickets, searchLiveFares } from "@/app/actions/duffel";
import { formatQuoteMoney } from "@/lib/quote-rules";
import type { DuffelMode } from "@/lib/duffel/config";
import type { FareResult } from "@/lib/duffel/mapping";
import type { FareSearch } from "@/lib/ticketing-duffel";
import { cn } from "@/lib/utils";

/**
 * The desk's door to Duffel: search live fares into the fare options, and book
 * the chosen one once the client has paid. It adds a way to get fares and a
 * way to book them; the stages, the payment check and the records are the
 * ticketing file's own.
 */

const btn = "inline-flex h-9 items-center justify-center gap-2 rounded px-4 text-sm font-medium transition-colors disabled:opacity-60";
const primary = `${btn} bg-forest-800 text-bone-50 hover:bg-forest-900`;
const quiet = `${btn} border border-[var(--line-strong)] hover:bg-[var(--paper-sunken)]`;

export function ModeBadge({ mode }: { mode: DuffelMode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        mode === "sandbox" ? "bg-sun-300/40 text-sun-900" : "bg-clay-100 text-clay-800",
      )}
      title={mode === "sandbox" ? "Test data: no real tickets are issued and no real money moves." : "Live: real tickets are issued and real money moves."}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {mode === "sandbox" ? "Sandbox" : "Live"}
    </span>
  );
}

function Notice({ kind, children }: { kind: "ok" | "error" | "info"; children: React.ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-2 rounded border px-3 py-2 text-sm",
        kind === "error" && "border-clay-300 bg-clay-100 text-clay-800",
        kind === "ok" && "border-forest-800/30 bg-forest-50 text-forest-900",
        kind === "info" && "border-[var(--line)] bg-[var(--paper)] text-[var(--ink-muted)]",
      )}
    >
      {kind === "error" ? <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : kind === "ok" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
      <span>{children}</span>
    </p>
  );
}

const when = (iso: string) => iso.replace("T", " ").slice(0, 16);
const clock = (local: string) => local.slice(11, 16);

function ConnectionCheck({ mode }: { mode: DuffelMode }) {
  const [state, setState] = React.useState<"idle" | "busy" | { ok: boolean; text: string }>("idle");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ModeBadge mode={mode} />
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-lake-700 hover:underline disabled:opacity-60"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          const res = await checkDuffel();
          setState(res.ok ? { ok: true, text: `Connected to Duffel (${res.mode}).` } : { ok: false, text: res.message });
        }}
      >
        <Plug className="size-3.5" aria-hidden />
        {state === "busy" ? "Checking…" : "Test connection"}
      </button>
      {typeof state === "object" ? <span className={cn("text-xs", state.ok ? "text-forest-800" : "text-clay-700")}>{state.text}</span> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- search */

function FareCard({ fare, picked, onToggle, disabled }: { fare: FareResult; picked: boolean; onToggle: () => void; disabled: boolean }) {
  return (
    <li className={cn("rounded-[var(--radius-card)] border bg-[var(--paper-raised)] p-4 transition-colors", picked ? "border-forest-800 ring-1 ring-forest-800" : "border-[var(--line)]")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {fare.airline.logo ? (
            <Image src={fare.airline.logo} alt="" width={32} height={32} unoptimized className="size-8 object-contain" referrerPolicy="no-referrer" />
          ) : (
            <span className="grid size-8 place-items-center rounded bg-[var(--paper-sunken)]"><Plane className="size-4" aria-hidden /></span>
          )}
          <div>
            <p className="font-semibold">{fare.airline.name}{fare.fareBrand ? <span className="ml-2 text-sm font-normal text-[var(--ink-muted)]">{fare.fareBrand}</span> : null}</p>
            <p className="text-xs text-[var(--ink-faint)]">Price held until {when(fare.expiresAt)} UTC</p>
          </div>
        </div>
        <div className="text-right">
          <p className="tnum font-display text-2xl leading-none">{formatQuoteMoney(fare.totalMinor, fare.currency)}</p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">whole party</p>
        </div>
      </div>

      <ul className="mt-3 grid gap-2">
        {fare.slices.map((slice, i) => (
          <li key={i} className="rounded bg-[var(--paper)] px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {slice.from} {clock(slice.segments[0]!.departLocal)} → {slice.to} {clock(slice.segments.at(-1)!.arriveLocal)}
              </span>
              <span className="text-xs text-[var(--ink-muted)]">
                {slice.duration}{slice.duration ? " · " : ""}{slice.stops === 0 ? "Direct" : `${slice.stops} ${slice.stops === 1 ? "stop" : "stops"}`}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--ink-faint)]">
              {slice.segments[0]!.departLocal.slice(0, 10)} · {slice.segments.map((s) => s.flight).join(", ")}
            </p>
          </li>
        ))}
      </ul>

      <dl className="mt-3 grid gap-2 text-xs text-[var(--ink-muted)] sm:grid-cols-3">
        <div><dt className="font-semibold text-[var(--ink)]">Baggage</dt><dd>{fare.baggage}</dd></div>
        <div><dt className="font-semibold text-[var(--ink)]">Changes</dt><dd>{fare.changeRule}</dd></div>
        <div><dt className="font-semibold text-[var(--ink)]">Refunds</dt><dd>{fare.refundRule}</dd></div>
      </dl>

      <label className={cn("mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-medium", disabled && !picked && "cursor-not-allowed opacity-50")}>
        <input type="checkbox" checked={picked} disabled={disabled && !picked} onChange={onToggle} className="size-4 accent-forest-800" />
        Add to the fare options
      </label>
    </li>
  );
}

export function LiveFares({ reference, version, mode, optionCount }: { reference: string; version: number; mode: DuffelMode; optionCount: number }) {
  const router = useRouter();
  const [search, setSearch] = React.useState<FareSearch | null>(null);
  const [busy, setBusy] = React.useState<"search" | "add" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const room = Math.max(0, 6 - optionCount);

  async function run() {
    setBusy("search");
    setError(null);
    setDone(null);
    setPicked(new Set());
    const res = await searchLiveFares(reference);
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setSearch(res.data);
  }

  async function add() {
    setBusy("add");
    setError(null);
    const res = await addLiveFares({ reference, version, offerIds: [...picked] });
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setDone(res.message ?? "Added.");
    setSearch(null);
    setPicked(new Set());
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg">Live fares</h3>
          <p className="text-sm text-[var(--ink-muted)]">Search Duffel for this enquiry&apos;s route, dates and party, then add the fares to share with the client.</p>
        </div>
        <button type="button" onClick={() => void run()} disabled={busy !== null || room === 0} className={primary}>
          {busy === "search" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
          {busy === "search" ? "Searching…" : search ? "Search again" : "Search live fares"}
        </button>
      </div>
      <ConnectionCheck mode={mode} />
      {mode === "sandbox" ? <Notice kind="info">Sandbox mode returns test fares only. Nothing booked here is a real ticket.</Notice> : null}
      {room === 0 ? <Notice kind="info">This file already holds six fare options. Remove one to add more.</Notice> : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      {done ? <Notice kind="ok">{done}</Notice> : null}

      {search ? (
        search.results.length ? (
          <>
            <p className="text-sm text-[var(--ink-muted)]">
              {search.total} {search.total === 1 ? "fare" : "fares"} for {search.route}{search.total > search.results.length ? `, cheapest ${search.results.length} shown` : ""}. Prices can move; each fare is re-checked when added.
            </p>
            <ul className="grid gap-3">
              {search.results.map((fare) => (
                <FareCard
                  key={fare.id}
                  fare={fare}
                  picked={picked.has(fare.id)}
                  disabled={picked.size >= room}
                  onToggle={() =>
                    setPicked((p) => {
                      const next = new Set(p);
                      if (next.has(fare.id)) next.delete(fare.id);
                      else next.add(fare.id);
                      return next;
                    })
                  }
                />
              ))}
            </ul>
            <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded border border-[var(--line-strong)] bg-[var(--paper-raised)] px-4 py-3 shadow-lg">
              <span className="text-sm">{picked.size ? `${picked.size} selected` : "Select the fares to offer"} <span className="text-[var(--ink-faint)]">· room for {room}</span></span>
              <button type="button" onClick={() => void add()} disabled={busy !== null || picked.size === 0} className={primary}>
                {busy === "add" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                {busy === "add" ? "Adding…" : `Add ${picked.size || ""} to options`.replace("  ", " ")}
              </button>
            </div>
          </>
        ) : (
          <Notice kind="info">Duffel found no fares for this route and date. Try changing the dates or allow connections.</Notice>
        )
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- booking */

export function DuffelBooking({
  reference, version, mode, status, externalStatus, orderId, isAdmin,
}: {
  reference: string; version: number; mode: DuffelMode; status: string; externalStatus: string | null; orderId: string | null; isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"book" | "refresh" | "clear" | null>(null);
  const [message, setMessage] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function act<T>(kind: "book" | "refresh" | "clear", fn: () => Promise<{ ok: true; message?: string; data: T } | { ok: false; error: string }>) {
    setBusy(kind);
    setMessage(null);
    const res = await fn();
    setBusy(null);
    setMessage(res.ok ? { kind: "ok", text: res.message ?? "Done." } : { kind: "error", text: res.error });
    router.refresh();
  }

  const attempting = externalStatus === "ATTEMPTING";
  const held = !!orderId && (externalStatus === "HELD" || externalStatus === "NEEDS_DESK") && status === "READY_TO_TICKET";
  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg">Book with Duffel</h3>
          <p className="text-sm text-[var(--ink-muted)]">
            {orderId ? <>Duffel order <span className="font-mono text-xs">{orderId}</span>.</> : "Books the chosen fare, pays from the Duffel balance, then records the reference and ticket numbers on this file."}
          </p>
        </div>
        <ModeBadge mode={mode} />
      </div>

      {attempting ? (
        <Notice kind="error">
          A booking attempt is marked on this file and its result is not confirmed. Check the Duffel dashboard for an order on this client before doing anything else.
        </Notice>
      ) : null}
      {externalStatus === "NEEDS_DESK" ? (
        <Notice kind="error">
          Online ticketing stopped and handed this booking to the desk. The reason is in the case timeline. Check the fare with the client before booking or paying.
        </Notice>
      ) : null}
      {externalStatus === "HELD" && orderId ? (
        <Notice kind="ok">The seats are held with Duffel. Once payment is verified, online ticketing pays the hold and issues the tickets.</Notice>
      ) : null}
      {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}

      <div className="flex flex-wrap gap-3">
        {status === "READY_TO_TICKET" && !attempting && !orderId ? (
          <button
            type="button"
            disabled={busy !== null}
            className={primary}
            onClick={() => {
              const ok = window.confirm(
                mode === "sandbox"
                  ? "Book this fare in the Duffel sandbox? It uses test data; no real ticket is issued."
                  : "Book this fare with Duffel? This issues real tickets and spends real Duffel balance.",
              );
              if (ok) void act("book", () => bookLiveFare({ reference, version }));
            }}
          >
            {busy === "book" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plane className="size-4" aria-hidden />}
            {busy === "book" ? "Booking… this can take a minute" : "Book and ticket"}
          </button>
        ) : null}
        {held ? (
          <button
            type="button"
            disabled={busy !== null}
            className={primary}
            onClick={() => {
              const ok = window.confirm(
                mode === "sandbox"
                  ? "Pay this hold in the Duffel sandbox? It uses test data; no real ticket is issued."
                  : "Pay this hold from the Duffel balance? This issues real tickets and spends real balance.",
              );
              if (ok) void act("book", () => payLiveHold({ reference, version }));
            }}
          >
            {busy === "book" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plane className="size-4" aria-hidden />}
            {busy === "book" ? "Paying… this can take a minute" : "Pay held booking and ticket"}
          </button>
        ) : null}
        {status === "TICKETING" && orderId ? (
          <button type="button" disabled={busy !== null} className={quiet} onClick={() => void act("refresh", () => refreshLiveTickets(reference))}>
            {busy === "refresh" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
            Collect ticket numbers
          </button>
        ) : null}
        {isAdmin && attempting && !orderId ? (
          <button
            type="button"
            disabled={busy !== null}
            className={quiet}
            onClick={() => {
              if (window.confirm("Only clear this after confirming in the Duffel dashboard that no order was made for this client. Clear the attempt?")) {
                void act("clear", () => clearLiveAttempt({ reference, version }));
              }
            }}
          >
            Clear unconfirmed attempt
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function DuffelNotConnected({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--line-strong)] p-4">
      <h3 className="flex items-center gap-2 text-lg"><Plug className="size-4" aria-hidden />Live fares</h3>
      <p className="mt-1 text-sm text-[var(--ink-muted)]">{message}</p>
    </div>
  );
}
