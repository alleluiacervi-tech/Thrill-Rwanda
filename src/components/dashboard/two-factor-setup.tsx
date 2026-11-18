"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Check, Copy, Download, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { forgetTrustedDevices, type SecurityState } from "@/app/actions/security";
import { fieldCls, FormBanner, Labelled } from "@/components/dashboard/listing-fields";
import { Button } from "@/components/ui/button";
import { twoFactor } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

/**
 * Setting up two-step sign-in, in three short steps:
 *   1. confirm the password,
 *   2. scan the QR code (or type the key) and save the backup codes,
 *   3. enter the first six-digit code to prove the app is set up.
 * Until step 3 succeeds, nothing changes about how the person signs in.
 */
export function TwoFactorSetup({
  enabled,
  required,
  trustedDevices,
  next,
  email,
}: {
  enabled: boolean;
  /** Administrators and staff cannot switch it off. */
  required: boolean;
  trustedDevices: number;
  /** Where to continue once set up, when the guard sent them here. */
  next?: string;
  email: string;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState<"start" | "scan" | "done">(enabled ? "done" : "start");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [qr, setQr] = React.useState<string>("");
  const [key, setKey] = React.useState("");
  const [codes, setCodes] = React.useState<string[]>([]);
  const [copied, setCopied] = React.useState(false);

  async function start(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    const { data, error } = await twoFactor.enable({ password, issuer: "Thrill Rwanda", method: "totp" });
    setPending(false);
    if (error || !data || data.method !== "totp") {
      setError(error?.status === 400 || error?.status === 401 ? "That password isn't right." : "Couldn't start set-up. Try again.");
      return;
    }
    const uri = data.totpURI;
    setKey(new URL(uri).searchParams.get("secret") ?? "");
    setCodes(data.backupCodes);
    // Drawn here, from the URI: the secret never leaves this page as an image request.
    setQr(await QRCode.toDataURL(uri, { margin: 1, width: 240, color: { dark: "#0f3a2c", light: "#ffffff" } }));
    setStep("scan");
  }

  async function confirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const code = String(new FormData(e.currentTarget).get("code") ?? "").replace(/\s+/g, "");
    const { error } = await twoFactor.verifyTotp({ code, trustDevice: true });
    setPending(false);
    if (error) {
      setError("That code didn't match. Check the time on your phone is set automatically, then use the current code.");
      return;
    }
    setStep("done");
    router.refresh();
    if (next) router.push(next);
  }

  const download = () => {
    const text = `Thrill Rwanda backup codes for ${email}\nEach code works once. Keep them somewhere safe.\n\n${codes.join("\n")}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "thrill-rwanda-backup-codes.txt" });
    a.click();
    URL.revokeObjectURL(url);
  };

  if (step === "done") {
    return (
      <div className="space-y-6">
        <section className="flex items-start gap-4 rounded-[var(--radius-card)] border border-forest-300 bg-forest-100 p-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-forest-800 text-sun-400">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-xl text-forest-900">Two-step sign-in is on</h2>
            <p className="mt-1 text-sm leading-relaxed text-forest-900/80">
              After your password, you&rsquo;ll be asked for the six-digit code from your authenticator app,
              except on devices you chose to trust for 30 days.
              {required ? " It is required for your role, so it can't be switched off." : ""}
            </p>
            {next ? (
              <Button href={next} variant="primary" className="mt-4">
                Continue
              </Button>
            ) : null}
          </div>
        </section>
        {codes.length ? <BackupCodes codes={codes} onDownload={download} /> : null}
        <TrustedDevices count={trustedDevices} />
      </div>
    );
  }

  if (step === "scan") {
    return (
      <div className="space-y-6">
        <section className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6">
          <h2 className="flex items-center gap-2 text-xl">
            <span className="tnum grid size-7 place-items-center rounded-full bg-forest-800 text-xs text-bone-50">2</span>
            Scan this code with your authenticator app
          </h2>
          <div className="mt-5 grid items-start gap-6 sm:grid-cols-[15rem_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL drawn in the browser */}
            <img
              src={qr}
              alt="QR code for setting up Thrill Rwanda in an authenticator app"
              width={240}
              height={240}
              className="rounded-xl border border-[var(--line)] bg-white p-2"
            />
            <div className="space-y-4 text-sm leading-relaxed text-[var(--ink-muted)]">
              <p>
                Open Google Authenticator, Microsoft Authenticator, 1Password or any authenticator app, choose
                <strong className="text-[var(--ink)]"> Add account → Scan a QR code</strong>, and point it at the code.
              </p>
              <div>
                <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
                  Can&rsquo;t scan? Type this key
                </p>
                <p className="mt-1.5 flex items-center gap-2">
                  <code className="tnum break-all rounded bg-[var(--paper-sunken)] px-2 py-1 text-[0.8125rem] tracking-wider text-[var(--ink)]">
                    {key.replace(/(.{4})/g, "$1 ").trim()}
                  </code>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(key);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    aria-label="Copy key"
                    className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--line-strong)] hover:bg-[var(--paper-sunken)]"
                  >
                    {copied ? <Check className="size-4 text-forest-700" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </section>

        <BackupCodes codes={codes} onDownload={download} />

        <form onSubmit={confirm} className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6" noValidate>
          <h2 className="flex items-center gap-2 text-xl">
            <span className="tnum grid size-7 place-items-center rounded-full bg-forest-800 text-xs text-bone-50">3</span>
            Enter the code the app shows
          </h2>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            This proves the app is set up. This device will be trusted for 30 days.
          </p>
          <div className="mt-4 space-y-4">
            <FormBanner message={error ?? undefined} />
            <Labelled label="Six-digit code">
              <input
                name="code"
                required
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={7}
                placeholder="123 456"
                className={cn(fieldCls, "tnum max-w-48 text-lg tracking-[0.3em]")}
              />
            </Labelled>
            <Button type="submit" variant="accent" size="lg" disabled={pending}>
              {pending ? "Checking…" : "Turn on two-step sign-in"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={start} className="space-y-5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6">
      <h2 className="flex items-center gap-2 text-xl">
        <span className="tnum grid size-7 place-items-center rounded-full bg-forest-800 text-xs text-bone-50">1</span>
        Confirm it&rsquo;s you
      </h2>
      <ul className="space-y-2 text-sm text-[var(--ink-muted)]">
        <li className="flex gap-2">
          <Smartphone className="mt-0.5 size-4 shrink-0 text-forest-700" aria-hidden />
          You&rsquo;ll need an authenticator app on your phone. Google Authenticator and Microsoft Authenticator are free.
        </li>
        <li className="flex gap-2">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-forest-700" aria-hidden />
          You&rsquo;ll get ten backup codes for when your phone isn&rsquo;t with you.
        </li>
      </ul>
      <FormBanner message={error ?? undefined} />
      <Labelled label="Your password">
        <input name="password" type="password" required autoComplete="current-password" className={cn(fieldCls, "max-w-sm")} />
      </Labelled>
      <Button type="submit" variant="accent" size="lg" disabled={pending}>
        {pending ? "Starting…" : "Set up two-step sign-in"}
      </Button>
    </form>
  );
}

function BackupCodes({ codes, onDownload }: { codes: string[]; onDownload: () => void }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-sun-300 bg-sun-50 p-6">
      <h2 className="flex items-center gap-2 text-xl">
        <KeyRound className="size-5 text-clay-700" aria-hidden />
        Save your backup codes
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
        If your phone is lost or not with you, each of these signs you in once. They are shown only now: download
        them or write them down and keep them somewhere safe.
      </p>
      <ul className="tnum mt-4 grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5">
        {codes.map((c) => (
          <li key={c} className="rounded border border-[var(--line)] bg-white px-2 py-1.5 text-center">
            {c}
          </li>
        ))}
      </ul>
      <Button type="button" variant="quiet" className="mt-4" onClick={onDownload}>
        <Download className="size-4" aria-hidden />
        Download as a text file
      </Button>
    </section>
  );
}

function TrustedDevices({ count }: { count: number }) {
  const [state, action, pending] = useActionState<SecurityState>(forgetTrustedDevices, { status: "idle" });
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6">
      <h2 className="text-xl">Trusted devices</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--ink-muted)]">
        {count
          ? `${count} ${count === 1 ? "device skips" : "devices skip"} the code for up to 30 days after it was trusted.`
          : "No device skips the code right now."}{" "}
        If a phone or laptop is lost, or you used a shared computer, stop trusting them all; each will ask for a code
        at its next sign-in.
      </p>
      <form action={action} className="mt-4">
        <Button type="submit" variant="outline" disabled={pending || count === 0}>
          {pending ? "Working…" : "Stop trusting all devices"}
        </Button>
      </form>
      {state.message ? (
        <p role={state.status === "error" ? "alert" : "status"} className="mt-3 text-sm text-[var(--ink-muted)]">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
