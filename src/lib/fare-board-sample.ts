import { allDestinations } from "@/lib/flight-destinations";
import type { BoardFare, FareBoard } from "@/lib/fare-board";

/**
 * Invented fares for reviewing the board's design on a local machine
 * (/flights?fares=sample). The page refuses this in production.
 */
export function sampleFareBoard(source: "duffel" | "skyscanner" = "duffel"): FareBoard {
  const place = (code: string) => allDestinations.find((p) => p.code === code)!;
  const fare = (code: string, price: string, date: string, stops: number, airline: string, note?: string): BoardFare => ({
    place: place(code), price, date, stops, airline, note,
  });
  const cheap = [
    fare("EBB", "US$189", "2026-12-15", 0, "RwandAir"),
    fare("NBO", "US$215", "2026-12-22", 0, "Kenya Airways"),
    fare("BJM", "US$228", "2026-12-09", 0, "RwandAir"),
    fare("DAR", "US$264", "2026-12-18", 0, "RwandAir"),
    fare("ADD", "US$301", "2027-01-06", 0, "Ethiopian Airlines"),
    fare("ZNZ", "US$338", "2026-12-28", 1, "Kenya Airways"),
  ];
  return {
    cheap,
    deals: [
      fare("DXB", "US$412", "2027-01-12", 1, "Qatar Airways", "18% below this route's 30-day average"),
      fare("JNB", "US$389", "2026-12-15", 0, "RwandAir", "12% below this route's 30-day average"),
    ],
    trending: [
      { place: place("DXB"), rank: 1, fare: cheap[0] && { ...cheap[0], place: place("DXB"), price: "US$412" } },
      { place: place("NBO"), rank: 2, fare: cheap[1] },
      { place: place("LHR"), rank: 3 },
      { place: place("EBB"), rank: 4, fare: cheap[0] },
    ],
    checkedOn: "2026-11-24",
    source,
  };
}
