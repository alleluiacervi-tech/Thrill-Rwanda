import { DashboardHead } from "@/components/dashboard/dashboard-shell";
import { Panel } from "@/components/dashboard/dash-ui";
import { MailClient } from "@/components/mail/mail-client";
import { mailConfig } from "@/lib/mail/config";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Mail", robots: { index: false, follow: false } };
// Always live: this page reads a mailbox, and must never be built or cached.
export const dynamic = "force-dynamic";

const VARS = [
  ["MAIL_USER", "contact@thrillrwanda.com", "The full mailbox address."],
  ["MAIL_PASSWORD", "(the mailbox password)", "Set in the host's secrets only. Never commit it."],
  ["MAIL_FROM_NAME", "Thrill Rwanda", "Optional. The name recipients see."],
  ["MAIL_IMAP_HOST / MAIL_SMTP_HOST", "mail.spacemail.com (both)", "Optional. These are the defaults."],
] as const;

export default async function MailPage() {
  await requireAdmin("/admin/mail");
  const config = mailConfig();

  return (
    <>
      <DashboardHead
        title="Mail"
        lede={config ? `The shared ${config.user} inbox. Anything you do here also shows in any other mail app signed in to it.` : "Read and send from the company mailbox."}
      />
      {config ? (
        <MailClient address={config.user} />
      ) : (
        <Panel title="Connect the mailbox" description="Add these settings to the host's environment, then reload this page.">
          <dl className="grid gap-4 text-sm">
            {VARS.map(([name, example, note]) => (
              <div key={name} className="grid gap-1 sm:grid-cols-[16rem_1fr] sm:gap-4">
                <dt className="font-mono text-xs font-semibold">{name}</dt>
                <dd>
                  <span className="font-mono text-xs">{example}</span>
                  <span className="mt-0.5 block text-xs text-[var(--ink-muted)]">{note}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-xs text-[var(--ink-muted)]">
            On Vercel this is Project Settings, Environment Variables. On the VPS it is the environment file the container reads.
            The password is only ever used on the server and is never shown in the browser.
          </p>
        </Panel>
      )}
    </>
  );
}
