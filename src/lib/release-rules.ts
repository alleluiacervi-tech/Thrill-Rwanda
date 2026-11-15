import { z } from "zod";
export const RELEASE_KEYS = [
  "HOSTING_ACCOUNT",
  "DATABASE_ACCOUNT",
  "AUTH_AND_DOMAIN",
  "REPOSITORY_ACCESS",
  "EMAIL_ACCOUNT",
  "STORAGE_ACCOUNT",
  "PAYMENT_OWNERSHIP",
  "SUPPLIER_AGREEMENTS",
  "PUBLIC_CONTENT",
  "LEGAL_AND_PRIVACY",
  "CONTACT_OWNERSHIP",
  "SUPPORT_ROTA",
  "RETENTION_AND_HOLDS",
  "BACKUP_RESTORE",
  "DEPLOY_ROLLBACK",
  "INCIDENT_MONITORING",
  "STAFF_WALKTHROUGH",
  "STAGING_ACCEPTANCE",
  "FOUNDER_SIGNOFF",
  "WHATSAPP_CHANNEL",
] as const;
export const releaseRecordSchema = z.object({
  key: z.enum(RELEASE_KEYS),
  version: z.coerce.number().int().min(-1),
  owner: z.string().trim().min(3).max(200),
  state: z.enum(["PENDING", "VERIFIED", "NOT_APPLICABLE"]),
  evidence: z.string().trim().min(20).max(3000),
  reviewAt: z.string().min(1).max(30),
  cost: z
    .string()
    .trim()
    .regex(/^$|^\d{1,8}(\.\d{1,2})?$/)
    .default(""),
  currency: z.enum(["USD", "EUR", "GBP", "RWF", ""]).default(""),
  renewalAt: z.string().max(30).default(""),
});
export function environmentName(env: NodeJS.ProcessEnv = process.env) {
  return ["development", "test", "staging", "production"].includes(
    env.APP_ENV ?? "",
  )
    ? env.APP_ENV!
    : env.NODE_ENV === "production"
      ? "UNDECLARED"
      : "development";
}
export function environmentChecks(env: NodeJS.ProcessEnv = process.env) {
  const parse = (value?: string) => {
    try {
      return new URL(value ?? "");
    } catch {
      return null;
    }
  };
  const app = environmentName(env),
    site = parse(env.NEXT_PUBLIC_SITE_URL),
    auth = parse(env.BETTER_AUTH_URL),
    database = parse(env.DATABASE_URL),
    direct = parse(env.DIRECT_URL);
  const deployed = ["staging", "production"].includes(app);
  const local = (u: URL | null) =>
    !!u && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  return [
    {
      key: "environment",
      ok: app !== "UNDECLARED",
      detail: "Explicit APP_ENV separates staging and production",
    },
    {
      key: "site_origin",
      ok:
        !!site &&
        !!auth &&
        site.origin === auth.origin && (!env.SITE_URL || parse(env.SITE_URL)?.origin === site.origin) &&
        (!deployed || site.protocol === "https:"),
      detail: "Auth and public origins match; deployed origins use HTTPS",
    },
    {
      key: "database",
      ok:
        !!database &&
        !!direct &&
        database.hostname.replace(/-pooler(?=\..*\.neon\.tech$)/, "") ===
          direct.hostname.replace(/-pooler(?=\..*\.neon\.tech$)/, "") &&
        database.pathname === direct.pathname &&
        (!deployed || !local(database)),
      detail:
        "Runtime/migration databases identify the same environment; deployed DB is not localhost",
    },
    {
      key: "auth_secret",
      ok: (env.BETTER_AUTH_SECRET?.length ?? 0) >= 32,
      detail: "Dedicated authentication secret has at least 32 characters",
    },
    {
      key: "cron_secret",
      ok: (env.CRON_SECRET?.length ?? 0) >= 32,
      detail:
        "Dedicated worker authorization secret has at least 32 characters",
    },
    {
      key: "database_tls",
      ok:
        !deployed ||
        database?.hostname.endsWith(".neon.tech") === true ||
        ["verify-full", "verify-ca", "require"].includes(
          database?.searchParams.get("sslmode") ?? "",
        ),
      detail: "Deployed database transport is encrypted",
    },
    {
      key: "private_storage",
      ok:
        !deployed ||
        !!(
          (env.CLOUDINARY_CLOUD_NAME &&
            env.CLOUDINARY_API_KEY &&
            env.CLOUDINARY_API_SECRET) ||
          (env.R2_ACCOUNT_ID &&
            env.R2_ACCESS_KEY_ID &&
            env.R2_SECRET_ACCESS_KEY &&
            env.R2_BUCKET &&
            env.R2_PUBLIC_URL)
        ),
      detail: "Deployed listing-image storage has a configured driver",
    },
    {
      key: "email_sender",
      ok: !!env.RESEND_API_KEY && !!env.EMAIL_FROM,
      detail:
        "Email provider credentials and sender are present (delivery still requires verification)",
    },
    {
      key: "backup_key",
      ok: /^[A-Za-z0-9+/]{43}=$/.test(env.BACKUP_ENCRYPTION_KEY ?? ""),
      detail: "Encrypted backup key is configured separately",
    },
    {
      key: "payment_mode",
      ok: env.PESAPAL_ENV !== "live" || env.PESAPAL_LIVE_APPROVED === "true",
      detail: "Live gateway requires explicit activation approval",
    },
  ];
}
export function releaseEvidenceComplete(
  rows: { key: string; state: string; reviewAt: Date }[],
  now = new Date(),
) {
  return RELEASE_KEYS.filter((k) => k !== "WHATSAPP_CHANNEL").every((key) =>
    rows.some(
      (r) => r.key === key && r.state === "VERIFIED" && r.reviewAt > now,
    ),
  );
}

export const operationsNow = () => new Date();
