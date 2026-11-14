/**
 * Demo catalogue content.
 *
 * This is placeholder data shaped like the Prisma models in
 * `prisma/schema.prisma`, so swapping these arrays for real queries is a
 * per-page change. The tour, hotel and vehicle data below is sample content
 * written for Rwanda, priced in US dollars (cents). Replace it with real
 * operators and rates before launch.
 */

export type Destination = {
  slug: string;
  name: string;
  region: string;
  blurb: string;
  /** Height above sea level, shown on the destination panels. Rwanda is sold on its hills. */
  elevation?: string;
  stays: number;
  tours: number;
};

export const destinations: Destination[] = [
  {
    slug: "volcanoes-national-park",
    name: "Volcanoes National Park",
    region: "Northwestern Rwanda",
    blurb: "A highland landscape shaped by volcanic peaks and montane forest.",
    elevation: "Up to 4,507 m",
    stays: 0,
    tours: 0,
  },
  {
    slug: "nyungwe-national-park",
    name: "Nyungwe National Park",
    region: "Southwestern Rwanda",
    blurb: "Montane rainforest, canopy walks and rich biodiversity.",
    elevation: "Up to 2,950 m",
    stays: 0,
    tours: 0,
  },
  {
    slug: "akagera-national-park",
    name: "Akagera National Park",
    region: "Eastern Rwanda",
    blurb: "Savannah, lakes and wildlife along Rwanda's eastern border.",
    elevation: "1,300–1,825 m",
    stays: 0,
    tours: 0,
  },
  {
    slug: "lake-kivu",
    name: "Lake Kivu",
    region: "Western Rwanda",
    blurb: "Calm shores, island trips and the Congo Nile Trail.",
    elevation: "1,460 m",
    stays: 0,
    tours: 0,
  },
  {
    slug: "kigali",
    name: "Kigali",
    region: "Central Rwanda",
    blurb: "A city base for museums, markets and onward journeys.",
    elevation: "1,567 m",
    stays: 0,
    tours: 0,
  },
];

export type Tour = {
  slug: string;
  name: string;
  destination: string;
  durationDays: number;
  nights: number;
  priceFrom: number;
  rating: number;
  reviews: number;
  maxParticipants: number;
  activities: string[];
  summary: string;
  provider: string;
  badge?: string;
};

export const tours: Tour[] = [
  {
    slug: "gorilla-trekking-volcanoes-2-day",
    name: "Mountain Gorilla Trekking",
    destination: "Volcanoes National Park",
    durationDays: 2,
    nights: 1,
    priceFrom: 189000,
    rating: 5.0,
    reviews: 214,
    maxParticipants: 8,
    activities: ["Gorilla trek", "Park permit", "Cultural village"],
    summary:
      "Trek through bamboo and montane forest to spend an hour with a habituated mountain gorilla family, with a licensed guide and park permit arranged.",
    provider: "Volcano Trails Rwanda",
    badge: "Most booked",
  },
  {
    slug: "akagera-big-five-3-day",
    name: "Akagera Big Five Safari",
    destination: "Akagera National Park",
    durationDays: 3,
    nights: 2,
    priceFrom: 78000,
    rating: 4.8,
    reviews: 137,
    maxParticipants: 6,
    activities: ["Game drives", "Boat safari", "Night drive"],
    summary:
      "Lions, rhino, elephants and hippos in Rwanda's savannah park, with a boat trip on Lake Ihema and a sunset drive.",
    provider: "Akagera Expeditions",
  },
  {
    slug: "nyungwe-canopy-chimps-3-day",
    name: "Nyungwe Chimps & Canopy Walk",
    destination: "Nyungwe National Park",
    durationDays: 3,
    nights: 2,
    priceFrom: 69000,
    rating: 4.8,
    reviews: 96,
    maxParticipants: 8,
    activities: ["Chimpanzee trek", "Canopy walk", "Tea plantation"],
    summary:
      "Track chimpanzees at dawn, cross the canopy walkway above the rainforest and visit a tea estate on the way.",
    provider: "Volcano Trails Rwanda",
  },
  {
    slug: "kigali-city-memorial-day",
    name: "Kigali City & Memorial Day Tour",
    destination: "Kigali",
    durationDays: 1,
    nights: 0,
    priceFrom: 12000,
    rating: 4.7,
    reviews: 302,
    maxParticipants: 12,
    activities: ["Memorial visit", "Craft markets", "Coffee tasting"],
    summary:
      "A guided day through Kigali: the Genocide Memorial, local craft markets, art galleries and a Rwandan coffee tasting.",
    provider: "Thrill Rwanda In-House",
    badge: "Day trip",
  },
  {
    slug: "lake-kivu-congo-nile-3-day",
    name: "Lake Kivu & Congo Nile Trail",
    destination: "Lake Kivu",
    durationDays: 3,
    nights: 2,
    priceFrom: 52000,
    rating: 4.8,
    reviews: 88,
    maxParticipants: 8,
    activities: ["Kayaking", "Island visit", "Lakeside hike"],
    summary:
      "Two nights on the shore of Lake Kivu with kayaking, a boat trip to the islands and a day on the Congo Nile Trail.",
    provider: "Kivu Horizon Safaris",
  },
  {
    slug: "grand-rwanda-7-day",
    name: "Grand Rwanda: Gorillas, Chimps & Big Five",
    destination: "Multi-park",
    durationDays: 7,
    nights: 6,
    priceFrom: 420000,
    rating: 5.0,
    reviews: 58,
    maxParticipants: 6,
    activities: ["Three parks", "Private guide", "All meals"],
    summary:
      "Our flagship circuit: gorillas in Volcanoes, chimpanzees in Nyungwe and the Big Five in Akagera, with one private guide throughout.",
    provider: "Volcano Trails Rwanda",
    badge: "Flagship",
  },
];

export type Hotel = {
  slug: string;
  name: string;
  location: string;
  stars: number;
  rating: number;
  reviews: number;
  priceFrom: number;
  amenities: string[];
  summary: string;
  provider: string;
  badge?: string;
};

export const hotels: Hotel[] = [
  {
    slug: "volcanoes-ridge-lodge",
    name: "Volcanoes Ridge Lodge",
    location: "Musanze, Northern Province",
    stars: 5,
    rating: 4.9,
    reviews: 188,
    priceFrom: 65000,
    amenities: ["Full board", "Volcano views", "Fireplace", "Wi-Fi"],
    summary:
      "Stone-and-thatch suites on a hillside facing the Virunga volcanoes, minutes from the gorilla trek start point.",
    provider: "Volcano Trails Rwanda",
    badge: "Guest favourite",
  },
  {
    slug: "kivu-lakeshore-lodge",
    name: "Kivu Lakeshore Lodge",
    location: "Rubavu, Western Province",
    stars: 4,
    rating: 4.7,
    reviews: 341,
    priceFrom: 21000,
    amenities: ["Lakefront", "Pool", "Breakfast", "Kayaks"],
    summary:
      "Quiet lakeside rooms with a private beach, a long pool and sunsets over Lake Kivu.",
    provider: "Kivu Horizon Safaris",
  },
  {
    slug: "kigali-parkside-suites",
    name: "Kigali Parkside Suites",
    location: "Kiyovu, Kigali",
    stars: 4,
    rating: 4.6,
    reviews: 512,
    priceFrom: 14500,
    amenities: ["City centre", "Workspace", "Gym", "Airport shuttle"],
    summary:
      "Serviced apartments in Kiyovu, the practical base for a first or last night in the capital.",
    provider: "Parkside Hospitality",
    badge: "Best for business",
  },
  {
    slug: "akagera-savannah-camp",
    name: "Akagera Savannah Camp",
    location: "Akagera National Park, Eastern Province",
    stars: 4,
    rating: 4.8,
    reviews: 124,
    priceFrom: 38000,
    amenities: ["Safari tents", "Full board", "Guided drives"],
    summary:
      "Tented suites overlooking the plains, with a guide who has worked the park for years.",
    provider: "Akagera Expeditions",
  },
];

export type Vehicle = {
  slug: string;
  make: string;
  model: string;
  year: number;
  category: string;
  seats: number;
  transmission: "Automatic" | "Manual";
  fuel: string;
  pricePerDay: number;
  rating: number;
  reviews: number;
  features: string[];
  provider: string;
  badge?: string;
};

export const vehicles: Vehicle[] = [
  {
    slug: "toyota-landcruiser-prado-2023",
    make: "Toyota",
    model: "Land Cruiser Prado",
    year: 2023,
    category: "4x4 Safari",
    seats: 7,
    transmission: "Automatic",
    fuel: "Diesel",
    pricePerDay: 28000,
    rating: 4.9,
    reviews: 87,
    features: ["4WD", "Pop-up roof", "Cooler box", "Unlimited km"],
    provider: "Kigali Prime Fleet",
    badge: "Safari ready",
  },
  {
    slug: "toyota-alphard-2022",
    make: "Toyota",
    model: "Alphard Executive",
    year: 2022,
    category: "Executive Van",
    seats: 6,
    transmission: "Automatic",
    fuel: "Petrol",
    pricePerDay: 22000,
    rating: 4.8,
    reviews: 143,
    features: ["Leather", "Captain seats", "Wi-Fi", "Chauffeur"],
    provider: "Kigali Prime Fleet",
  },
  {
    slug: "mercedes-e-class-2023",
    make: "Mercedes-Benz",
    model: "E-Class",
    year: 2023,
    category: "Executive Sedan",
    seats: 4,
    transmission: "Automatic",
    fuel: "Petrol",
    pricePerDay: 24000,
    rating: 4.9,
    reviews: 61,
    features: ["Chauffeur", "Airport meet", "Bottled water"],
    provider: "Thrill Rwanda In-House",
    badge: "Corporate",
  },
  {
    slug: "toyota-rav4-2022",
    make: "Toyota",
    model: "RAV4",
    year: 2022,
    category: "Compact SUV",
    seats: 5,
    transmission: "Automatic",
    fuel: "Petrol",
    pricePerDay: 11000,
    rating: 4.7,
    reviews: 208,
    features: ["Self-drive", "Fuel efficient", "Unlimited km"],
    provider: "Kigali Prime Fleet",
    badge: "Best value",
  },
];

export const whyUs = [
  {
    title: "Rwanda-focused",
    body: "The destination examples highlight Volcanoes, Nyungwe and Akagera National Parks.",
  },
  {
    title: "Sample listings",
    body: "The current catalogue is sample material and is not a live offer from Thrill Rwanda.",
  },
  {
    title: "Prices not configured",
    body: "Displayed catalogue prices and payment options must be replaced and verified before launch.",
  },
  {
    title: "Contact details pending",
    body: "Phone, email, address and enquiry channels will appear once the business details are configured.",
  },
];

/* ================================================================ DETAIL ==
   Extra fields the detail pages need. Kept alongside the list data so the
   swap to Prisma queries stays a per-page change.
   ======================================================================== */

export type ItineraryDay = { day: number; title: string; body: string };

export const tourItineraries: Record<string, ItineraryDay[]> = {
  "gorilla-trekking-volcanoes-2-day": [
    {
      day: 1,
      title: "Kigali to Musanze",
      body: "Pickup from your hotel or Kigali airport and a scenic two-hour drive north to Musanze. Settle into the lodge, with an optional afternoon visit to a cultural village.",
    },
    {
      day: 2,
      title: "Gorilla trek and return",
      body: "A briefing at park headquarters at dawn, then a guided trek to your assigned gorilla family and an hour in their company. Lunch, then the drive back to Kigali for the evening.",
    },
  ],
  "akagera-big-five-3-day": [
    {
      day: 1,
      title: "Kigali to Akagera",
      body: "A morning drive east to Akagera National Park, lunch at the camp and an afternoon game drive across the plains.",
    },
    {
      day: 2,
      title: "Full day in the park",
      body: "An early drive for lions and rhino, a boat safari on Lake Ihema in the afternoon and a sunset drive back to camp.",
    },
    {
      day: 3,
      title: "Morning drive and return",
      body: "A final drive at first light, breakfast, then back to Kigali by mid-afternoon with drop-off at your hotel or the airport.",
    },
  ],
};

export const tourIncludes = [
  "Park entry fees",
  "4x4 safari vehicle",
  "Resident English-speaking guide",
  "All accommodation as listed",
  "All meals on safari",
  "Bottled water throughout",
];

export const tourExcludes = [
  "International flights",
  "Visa fees (many travellers can apply online)",
  "Travel insurance",
  "Tips and personal spending",
];

export type RoomType = {
  slug: string;
  name: string;
  capacity: number;
  pricePerNight: number;
  size: string;
  beds: string;
  features: string[];
};

export const hotelRooms: Record<string, RoomType[]> = {
  "volcanoes-ridge-lodge": [
    {
      slug: "volcano-view-suite",
      name: "Volcano View Suite",
      capacity: 2,
      pricePerNight: 78000,
      size: "52 m²",
      beds: "1 king",
      features: ["Volcano views", "Fireplace", "Full board"],
    },
    {
      slug: "family-cottage",
      name: "Family Cottage",
      capacity: 4,
      pricePerNight: 110000,
      size: "78 m²",
      beds: "1 king + 2 singles",
      features: ["Two bedrooms", "Private veranda", "Full board"],
    },
  ],
  "kivu-lakeshore-lodge": [
    {
      slug: "garden-double",
      name: "Garden Double",
      capacity: 2,
      pricePerNight: 21000,
      size: "28 m²",
      beds: "1 queen",
      features: ["Garden view", "Air conditioning", "Breakfast"],
    },
    {
      slug: "lake-suite",
      name: "Lake Suite",
      capacity: 3,
      pricePerNight: 34000,
      size: "44 m²",
      beds: "1 king + sofa bed",
      features: ["Lake view", "Balcony", "Breakfast"],
    },
  ],
};

// Transfer routes and prices now live in the database: Admin -> Transfer routes.

/* ---------------------------------------------------------- lookups ---- */

export const findTour = (slug: string) => tours.find((t) => t.slug === slug);
export const findHotel = (slug: string) => hotels.find((h) => h.slug === slug);
export const findVehicle = (slug: string) =>
  vehicles.find((v) => v.slug === slug);
