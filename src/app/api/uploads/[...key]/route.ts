import { readLocal } from "@/lib/storage";

// Serves the dev disk driver's files. Not public/: that is copied at build
// time, so runtime writes there work in dev and vanish in production.

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const file = await readLocal(key.join("/"));

  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      // The key carries a UUID, so a URL's bytes never change.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
