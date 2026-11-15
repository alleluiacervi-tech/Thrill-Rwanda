import { pesapalBase, pesapalToken } from "./pesapal";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  environmentChecks,
  environmentName,
  releaseEvidenceComplete,
  RELEASE_KEYS,
} from "./release-rules";
import {
  backupKey,
  encryptBackup,
  decryptBackup,
  signManifest,
  verifyManifest,
} from "../../scripts/backup-crypto";
import { safeRestoreTarget } from "../../scripts/restore-check";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { e164, sendWhatsAppTemplate } from "./whatsapp";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("release and channel boundaries", () => {
  it("does not infer a declared production environment", () => {
    expect(environmentName({ NODE_ENV: "production" })).toBe("UNDECLARED");
    expect(
      environmentChecks({ NODE_ENV: "production" }).some((c) => !c.ok),
    ).toBe(true);
  });
  it("requires current verified release evidence", () => {
    const rows = RELEASE_KEYS.filter((k) => k !== "WHATSAPP_CHANNEL").map(
      (key) => ({ key, state: "VERIFIED", reviewAt: new Date("2038-01-01") }),
    );
    expect(releaseEvidenceComplete(rows)).toBe(true);
    expect(releaseEvidenceComplete(rows.slice(1))).toBe(false);
    expect(
      releaseEvidenceComplete([
        { ...rows[0], reviewAt: new Date(0) },
        ...rows.slice(1),
      ]),
    ).toBe(false);
  });
  it("requires a fresh isolated local restore database", () => {
    expect(
      safeRestoreTarget(
        "postgresql://local:unused@127.0.0.1:54329/thrill_restore_abcdefgh",
      ).pathname,
    ).toBe("/thrill_restore_abcdefgh");
    for (const target of [
      "postgresql://x@prod.invalid:54329/thrill_restore_abcdefgh",
      "postgresql://x@localhost:54329/thrill_rwanda",
      "postgresql://x@localhost:5432/thrill_restore_abcdefgh",
      "postgresql://x@localhost:54329/thrill_restore_abcdefgh?host=external.invalid",
    ])
      expect(() => safeRestoreTarget(target)).toThrow();
  });
  it("rejects invalid keys and authenticates backup metadata", () => {
    expect(() => backupKey("not-a-key")).toThrow();
    const key = randomBytes(32),
      m = { version: 1, count: 10 };
    expect(verifyManifest(m, signManifest(m, key), key)).toBe(true);
    expect(verifyManifest({ ...m, count: 9 }, signManifest(m, key), key)).toBe(
      false,
    );
  });
  it("round-trips encrypted data and refuses corrupted backups", async () => {
    const dir = await mkdtemp(join(tmpdir(), "thrill-backup-test-")),
      key = randomBytes(32),
      path = join(dir, "backup.trb");
    try {
      await encryptBackup(
        Readable.from(Buffer.from("sensitive fixture bytes")),
        path,
        key,
      );
      expect(
        (await readFile(path)).includes(Buffer.from("sensitive fixture bytes")),
      ).toBe(false);
      await decryptBackup(path, join(dir, "restored"), key);
      expect(await readFile(join(dir, "restored"), "utf8")).toBe(
        "sensitive fixture bytes",
      );
      const bytes = await readFile(path);
      bytes[22] ^= 1;
      await writeFile(path, bytes);
      await expect(
        decryptBackup(path, join(dir, "corrupt"), key),
      ).rejects.toThrow("authentication");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("defaults to sandbox and refuses unapproved live token requests", async () => {
    vi.stubEnv("PESAPAL_ENV", "");
    expect(pesapalBase()).toContain("cybqa");
    vi.stubEnv("PESAPAL_ENV", "live");
    vi.stubEnv("PESAPAL_LIVE_APPROVED", "false");
    await expect(pesapalToken()).rejects.toThrow("approval");
  });
  it("normalizes explicit international phone consent", () => {
    expect(e164("+250 (788) 000-000")).toBe("+250788000000");
    expect(() => e164("0788000000")).toThrow();
  });
  it("sends only reference and status through the fixed template endpoint", async () => {
    vi.stubEnv("WHATSAPP_PHONE_ID", "1234567890");
    vi.stubEnv("WHATSAPP_STATUS_TEMPLATE", "approved_status");
    vi.stubEnv("WHATSAPP_TEMPLATE_LANGUAGE", "en");
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ messages: [{ id: "mock-wa-id" }] }), {
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    try {
      expect(
        (
          await sendWhatsAppTemplate({
            phone: "+250788000000",
            reference: "TRQ-FIXTURE",
            status: "QUOTE_SENT",
          })
        ).providerId,
      ).toBe("mock-wa-id");
      const [url, options] = fetcher.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      expect(url).toBe("https://graph.facebook.com/v22.0/1234567890/messages");
      const body = JSON.parse(String(options.body));
      expect(body.template.components[0].parameters).toEqual([
        { type: "text", text: "TRQ-FIXTURE" },
        { type: "text", text: "QUOTE SENT" },
      ]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
