import { db } from "@/lib/db";
import { interactionSchema } from "@/lib/launch-rules";
function isSameHost(request: Request) {
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    return (
      ["http:", "https:"].includes(origin.protocol) &&
      origin.host === (request.headers.get("host") ?? new URL(request.url).host)
    );
  } catch {
    return false;
  }
}
export async function POST(request: Request) {
  if (
    !isSameHost(request) ||
    Number(request.headers.get("content-length") ?? 0) > 512
  )
    return new Response(null, { status: 400 });
  const body = await request.text();
  if (body.length > 512) return new Response(null, { status: 400 });
  let raw;
  try {
    raw = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = interactionSchema.safeParse(raw);
  if (!parsed.success) return new Response(null, { status: 400 });
  const { service, placement } = parsed.data;
  // Fixed, bounded aggregate buckets; no IP, visitor, contact, route or query-string persistence.
  await db.$executeRaw`INSERT INTO interaction_daily (day,service,placement,clicks) VALUES ((now() AT TIME ZONE 'Africa/Kigali')::date,${service},${placement},1) ON CONFLICT (day,service,placement) DO UPDATE SET clicks=LEAST(interaction_daily.clicks+1,100000)`;
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
