import Link from "next/link";
export default function Page() {
  return (
    <main id="main" className="mx-auto max-w-xl space-y-6 px-6 py-24">
      <h1 className="text-4xl">Travel desk preview</h1>
      <p>
        This preview is open to invited participants. Sign in to your verified
        account, or contact the desk through the contact details supplied with
        your invitation.
      </p>
      <p>
        <Link href="/sign-in" className="underline">
          Sign in
        </Link>
      </p>
      <p>
        <Link href="/account" className="underline">
          Existing bookings and account
        </Link>
      </p>
    </main>
  );
}
