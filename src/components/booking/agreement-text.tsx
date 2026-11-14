import { agreementBlocks } from "@/lib/agreement";

/** The agreement body as headings and paragraphs. Server-rendered. */
export function AgreementText({ body }: { body: string }) {
  return (
    <div className="space-y-4">
      {agreementBlocks(body).map((block, i) =>
        block.kind === "heading" ? (
          <h2 key={i} className="pt-4 text-lg font-semibold first:pt-0">
            {block.text}
          </h2>
        ) : (
          <p key={i} className="whitespace-pre-line text-sm leading-relaxed text-[var(--ink-muted)]">
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}
