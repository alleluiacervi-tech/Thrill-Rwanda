import { airportCity } from "@/lib/flight-geography";
import { renderItineraryPdf, type ItineraryData } from "@/lib/itinerary-pdf";
import { getSite } from "@/lib/settings";
import { label } from "@/lib/enquiry-workflow";
import { airlineName } from "@/lib/ticketing-rules";

type Source = {
  pnr: string | null;
  partner: string;
  issuedAt: Date | null;
  options: {
    selected: boolean; fareBasis: string; baggage: string; changeRule: string; refundRule: string;
    segments: { airline: string; flightNumber: string; origin: string; destination: string; departLocal: string; arriveLocal: string; cabin: string; bookingClass: string; terminal: string }[];
  }[];
  passengers: { kind: string; title: string; givenNames: string; surname: string; ticketNumber: string | null; status: string }[];
};

/** Returns null until the file is issued, so an itinerary is never produced for an unticketed trip. */
export async function itineraryPdfResponse(source: Source, reference: string, customerName: string, company?: ItineraryData["company"]) {
  const option = source.options.find((item) => item.selected);
  if (!option || !source.pnr || !source.issuedAt) return null;
  const brand = company ? null : await getSite();
  const data: ItineraryData = {
    company: company ?? { name: brand!.legalName, email: brand!.contact.email, phone: brand!.contact.phone, address: brand!.contact.address },
    reference, pnr: source.pnr, partner: source.partner, issuedAt: source.issuedAt.toISOString(), customerName,
    passengers: source.passengers.map((p) => ({
      name: `${p.title ? `${p.title} ` : ""}${p.givenNames} ${p.surname}`.toUpperCase(), kind: label(p.kind), ticketNumber: p.ticketNumber, status: p.status,
    })),
    segments: option.segments.map((s) => ({
      airline: s.airline, airlineName: airlineName(s.airline), flightNumber: s.flightNumber,
      origin: s.origin, originCity: airportCity(s.origin), destination: s.destination, destinationCity: airportCity(s.destination),
      departLocal: s.departLocal, arriveLocal: s.arriveLocal, cabin: s.cabin, bookingClass: s.bookingClass, terminal: s.terminal,
    })),
    baggage: option.baggage, changeRule: option.changeRule, refundRule: option.refundRule, fareBasis: option.fareBasis,
  };
  const name = `itinerary-${reference}`.replace(/[^\w.-]+/g, "-");
  return new Response(Buffer.from(await renderItineraryPdf(data)), {
    headers: {
      "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    },
  });
}
