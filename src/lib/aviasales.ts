/**
 * Aviasales booking links (Travelpayouts affiliate programme).
 *
 * A link opens Aviasales' own search for the route and day, with our partner
 * marker so a booking made there is credited to us. Aviasales sells and issues
 * the ticket; the desk is not involved. Links appear only beside prices that
 * came from Aviasales (the Travelpayouts source), never beside the desk's own
 * fares, and only once TRAVELPAYOUTS_MARKER is set.
 *
 * No secret here: the marker is public by design, it travels in every link.
 */

export type AviasalesLinks = { marker: string; project: string | null; host: string };

export function aviasalesLinks(env: Record<string, string | undefined> = process.env): AviasalesLinks | null {
  const marker = env.TRAVELPAYOUTS_MARKER?.trim();
  if (!marker || !/^\d{3,12}$/.test(marker)) return null;
  const project = env.TRAVELPAYOUTS_PROJECT_ID?.trim();
  return {
    marker,
    project: project && /^\d{1,12}$/.test(project) ? project : null,
    host: env.AVIASALES_HOST?.trim() || "https://www.aviasales.com",
  };
}

/** Aviasales' search path: origin, day and month of departure, destination, adults. "KGL2212NBO1". */
export function searchPath(origin: string, destination: string, date: string, adults = 1) {
  const [, month, day] = date.split("-");
  return `/search/${origin}${day}${month}${destination}${adults}`;
}

/**
 * The link for one fare. With a project ID it goes through Travelpayouts'
 * tracked redirect (tp.media), the form their dashboard generates; without
 * one, the marker rides on the Aviasales link itself. `placement` says where
 * on our site the click came from, for the Travelpayouts statistics.
 */
export function aviasalesLink(
  links: AviasalesLinks,
  input: { origin: string; destination: string; date: string; placement: string },
): string | null {
  if (!/^[A-Z]{3}$/.test(input.origin) || !/^[A-Z]{3}$/.test(input.destination) || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return null;
  const placement = input.placement.replace(/[^a-z0-9_]/gi, "").slice(0, 30);
  const target = new URL(searchPath(input.origin, input.destination, input.date), links.host);
  if (!links.project) {
    target.searchParams.set("marker", placement ? `${links.marker}.${placement}` : links.marker);
    return target.toString();
  }
  const redirect = new URL("https://tp.media/r");
  redirect.search = new URLSearchParams({
    marker: links.marker,
    trs: links.project,
    p: "4114",
    u: target.toString(),
    campaign_id: "100",
    ...(placement ? { sub_id: placement } : {}),
  }).toString();
  return redirect.toString();
}
