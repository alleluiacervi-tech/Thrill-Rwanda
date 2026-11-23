/**
 * Places travellers most often ask the flights desk for, grouped for the
 * departures board. These are destinations, not services: nothing here says
 * an airline flies the route nonstop or on a given day.
 */
export type Destination = { code: string; city: string; country: string; lat?: number; lon?: number };

/** The hub every route on the board and the globe starts from. */
export const KIGALI = { code: "KGL", city: "Kigali", country: "RW", lat: -1.97, lon: 30.14 };
export type DestinationRegion = { id: string; label: string; places: Destination[] };

export const destinationRegions: DestinationRegion[] = [
  {
    id: "east-africa",
    label: "East Africa",
    places: [
      { code: "NBO", city: "Nairobi", country: "KE", lat: -1.32, lon: 36.93 },
      { code: "EBB", city: "Entebbe", country: "UG", lat: 0.04, lon: 32.44 },
      { code: "DAR", city: "Dar es Salaam", country: "TZ", lat: -6.88, lon: 39.2 },
      { code: "ZNZ", city: "Zanzibar", country: "TZ", lat: -6.22, lon: 39.22 },
      { code: "ADD", city: "Addis Ababa", country: "ET", lat: 8.98, lon: 38.8 },
      { code: "BJM", city: "Bujumbura", country: "BI", lat: -3.32, lon: 29.32 },
    ],
  },
  {
    id: "africa",
    label: "Across Africa",
    places: [
      { code: "JNB", city: "Johannesburg", country: "ZA", lat: -26.14, lon: 28.25 },
      { code: "CPT", city: "Cape Town", country: "ZA", lat: -33.97, lon: 18.6 },
      { code: "LOS", city: "Lagos", country: "NG", lat: 6.58, lon: 3.32 },
      { code: "ACC", city: "Accra", country: "GH", lat: 5.61, lon: -0.17 },
      { code: "FIH", city: "Kinshasa", country: "CD", lat: -4.39, lon: 15.44 },
      { code: "CAI", city: "Cairo", country: "EG", lat: 30.12, lon: 31.41 },
    ],
  },
  {
    id: "gulf-asia",
    label: "Gulf & Asia",
    places: [
      { code: "DXB", city: "Dubai", country: "AE", lat: 25.25, lon: 55.36 },
      { code: "DOH", city: "Doha", country: "QA", lat: 25.27, lon: 51.61 },
      { code: "IST", city: "Istanbul", country: "TR", lat: 41.26, lon: 28.74 },
      { code: "BOM", city: "Mumbai", country: "IN", lat: 19.09, lon: 72.87 },
    ],
  },
  {
    id: "europe",
    label: "Europe",
    places: [
      { code: "LHR", city: "London", country: "GB", lat: 51.47, lon: -0.45 },
      { code: "BRU", city: "Brussels", country: "BE", lat: 50.9, lon: 4.48 },
      { code: "AMS", city: "Amsterdam", country: "NL", lat: 52.31, lon: 4.76 },
      { code: "CDG", city: "Paris", country: "FR", lat: 49.01, lon: 2.55 },
      { code: "FRA", city: "Frankfurt", country: "DE", lat: 50.03, lon: 8.57 },
      { code: "ZRH", city: "Zurich", country: "CH", lat: 47.46, lon: 8.55 },
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
