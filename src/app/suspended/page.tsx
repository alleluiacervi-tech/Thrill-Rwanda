import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { getSite } from "@/lib/settings";

export const metadata = { robots: { index: false, follow: false } };

export default async function SuspendedPage() {
  const site = await getSite();
  return (
    <AuthShell
      title="This account is inactive"
      lede="Your account has been deactivated, so you can't sign in or make bookings. Existing bookings are unaffected."
    >
      <div className="space-y-5">
        <p className="rounded-[var(--radius-inset)] border border-clay-300 bg-clay-100 p-4 text-sm leading-relaxed text-clay-900">
          If you think this is a mistake, contact us on {site.contact.phone} or{" "}
          {site.contact.email} and we&rsquo;ll look into it straight away.
        </p>
        <Button href="/contact" variant="accent" size="lg" className="w-full">
          Contact us
        </Button>
      </div>
    </AuthShell>
  );
}
