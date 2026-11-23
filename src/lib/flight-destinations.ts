/**
 * Places travellers most often ask the flights desk for, grouped for the
 * departures board. These are destinations, not services: nothing here says
 * an airline flies the route nonstop or on a given day.
 */
export type Destination = { code: string; city: string; country: string };
export type DestinationRegion = { id: string; label: string; places: Destination[] };

export const destinationRegions: DestinationRegion[] = [
  {
    id: "east-africa",
    label: "East Africa",
    places: [
      { code: "NBO", city: "Nairobi", country: "KE" },
      { code: "EBB", city: "Entebbe", country: "UG" },
      { code: "DAR", city: "Dar es Salaam", country: "TZ" },
      { code: "ZNZ", city: "Zanzibar", country: "TZ" },
      { code: "ADD", city: "Addis Ababa", country: "ET" },
      { code: "BJM", city: "Bujumbura", country: "BI" },
    ],
  },
  {
    id: "africa",
    label: "Across Africa",
    places: [
      { code: "JNB", city: "Johannesburg", country: "ZA" },
      { code: "CPT", city: "Cape Town", country: "ZA" },
      { code: "LOS", city: "Lagos", country: "NG" },
      { code: "ACC", city: "Accra", country: "GH" },
      { code: "FIH", city: "Kinshasa", country: "CD" },
      { code: "CAI", city: "Cairo", country: "EG" },
    ],
  },
  {
    id: "gulf-asia",
    label: "Gulf & Asia",
    places: [
      { code: "DXB", city: "Dubai", country: "AE" },
      { code: "DOH", city: "Doha", country: "QA" },
      { code: "IST", city: "Istanbul", country: "TR" },
      { code: "BOM", city: "Mumbai", country: "IN" },
    ],
  },
  {
    id: "europe",
    label: "Europe",
    places: [
      { code: "LHR", city: "London", country: "GB" },
      { code: "BRU", city: "Brussels", country: "BE" },
      { code: "AMS", city: "Amsterdam", country: "NL" },
      { code: "CDG", city: "Paris", country: "FR" },
      { code: "FRA", city: "Frankfurt", country: "DE" },
      { code: "ZRH", city: "Zurich", country: "CH" },
    ],
  },
];

export const allDestinations: Destination[] = destinationRegions.flatMap((region) => region.places);

/** Shown in the airport search before anything is typed. */
export const popularDestinations: Destination[] = ["NBO", "EBB", "DXB", "JNB", "LHR", "BRU", "DOH", "ADD"].map(
  (code) => allDestinations.find((place) => place.code === code)!,
);

export const placeLabel = ({ city, code }: Destination) => `${city} (${code})`;

/** Fired by the departures board; the search panel listens and fills its destination. */
export const PICK_DESTINATION_EVENT = "thrill:flight-destination";
