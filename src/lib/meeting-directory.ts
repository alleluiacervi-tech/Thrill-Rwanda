export const layouts = ["Theatre", "Classroom", "Conference", "U-shape", "Reception", "Banquet", "Boardroom"] as const;
export type Layout = (typeof layouts)[number];

export type MeetingVenue = {
  slug: string;
  kind: "Hotel" | "Convention centre";
  name: string;
  description: string;
  source?: string;
  image?: string;
  imageAlt?: string;
};

export const meetingVenues: MeetingVenue[] = [
  {
    slug: "kigali-convention-centre",
    kind: "Convention centre",
    name: "Kigali Convention Centre",
    description: "Conference halls, exhibition space and smaller meeting rooms for summits and multi-track events.",
    source: "https://www.radissonhotels.com/en-us/hotels/radisson-blu-convention-kigali/meeting-events",
    image: "/media/photos/kigali-convention-centre-night.jpeg",
    imageAlt: "Kigali Convention Centre’s illuminated dome at night",
  },
  {
    slug: "intare-conference-arena",
    kind: "Convention centre",
    name: "Intare Conference Arena",
    description: "A conference and exhibition venue for large meetings, presentations and corporate gatherings.",
    source: "https://intare.rw/?page=facility",
    image: "/media/photos/intare-conference-arena.jpg",
    imageAlt: "The arched entrance and landscaped grounds of Intare Conference Arena",
  },
  {
    slug: "kigali-marriott-hotel",
    kind: "Hotel",
    name: "Kigali Marriott Hotel",
    description: "Hotel ballrooms and meeting rooms for workshops, conferences and events with overnight stays.",
    source: "https://www.marriott.com/en-us/hotels/kglmc-kigali-marriott-hotel/events/",
    image: "/media/photos/kigali-marriott-ballroom.jpg",
    imageAlt: "Kigali Marriott Hotel ballroom set for a banquet",
  },
  {
    slug: "kigali-serena-hotel",
    kind: "Hotel",
    name: "Kigali Serena Hotel",
    description: "A ballroom, auditorium and executive meeting rooms for conferences, receptions and board meetings.",
    source: "https://www.serenahotels.com/kigali/",
    image: "/media/photos/kigali-serena-auditorium.jpg",
    imageAlt: "Kigali Serena Hotel auditorium arranged with round tables",
  },
  {
    slug: "four-points-kigali",
    kind: "Hotel",
    name: "Four Points by Sheraton Kigali",
    description: "Ballroom, breakout rooms and smaller meeting spaces.",
    source: "https://www.marriott.com/en-us/hotels/kglfp-four-points-kigali/events/",
  },
  {
    slug: "park-inn-kigali",
    kind: "Hotel",
    name: "Park Inn by Radisson Kigali",
    description: "Adjoining ballrooms and smaller workshop rooms.",
    source: "https://www.radissonhotels.com/en-us/hotels/park-inn-kigali/meeting-events",
  },
  {
    slug: "onomo-kigali",
    kind: "Hotel",
    name: "ONOMO Hotel Kigali",
    description: "Meeting rooms for workshops, seminars and team sessions.",
    source: "https://www.onomohotels.com/en/hotel/onomo-hotel-kigali/",
  },
];

export const spaceTypes = ["Ballroom", "Conference hall", "Meeting room", "Boardroom", "Outdoor", "Foyer"] as const;
export type SpaceType = (typeof spaceTypes)[number];
export type MeetingSpace = {
  id: string;
  venue: string;
  name: string;
  type: SpaceType;
  capacities: Partial<Record<Layout, number>>;
  publishedMaximum?: number;
  features?: string;
};

// Layout figures follow the order above. A blank means the operator did not publish a figure.
type Room = [name: string, type: SpaceType, capacities?: (number | null)[], publishedMaximum?: number];
const inventory: Record<string, Room[]> = {
  "kigali-convention-centre": [
    ["Auditorium", "Conference hall"],
    ["AD1", "Meeting room", [], 30], ["AD2", "Meeting room"],
    ["AD3", "Meeting room", [], 30], ["AD4", "Meeting room", [], 60],
    ["AD5", "Meeting room", [], 12], ["AD6", "Meeting room", [], 12],
    ["AD7", "Meeting room", [], 24], ["AD8", "Meeting room", [], 10],
    ["AD9", "Meeting room", [], 10], ["AD10", "Meeting room", [], 250],
    ["AD11", "Meeting room", [], 80], ["AD12", "Meeting room", [], 300],
    ["AD 10+11", "Meeting room", [], 350], ["AD 10+12", "Meeting room", [], 350],
    ["AD 10+11+12", "Meeting room"],
    ["Foyer 1A", "Foyer"], ["Foyer 1B", "Foyer"], ["Foyer 1C", "Foyer"],
    ["MR 6 VC Room", "Meeting room", [], 10],
    ["Meeting Hall 1", "Conference hall", [], 550],
    ["Meeting Hall 2", "Conference hall", [], 550],
    ["Meeting Hall 3", "Conference hall", [], 550],
    ["Meeting Hall 4", "Conference hall"],
    ["Meeting Hall 1+2", "Conference hall"], ["Meeting Hall 2+3", "Conference hall"],
    ["Meeting Hall 3+4", "Conference hall"], ["Meeting Hall 1+2+3", "Conference hall"],
    ["Meeting Hall 2+3+4", "Conference hall"], ["Meeting Hall 1+2+3+4", "Conference hall", [], 2800],
    ["Terrace 1", "Outdoor"],
  ],
  "intare-conference-arena": [
    ["Conference Hall", "Conference hall", [2500, 471, null, 87, null, 700, 115]],
    ["Umuco", "Meeting room", [32, 18, null, 15, null, null, 18]],
    ["Intore", "Boardroom", [null, null, null, null, null, null, 20]],
    ["Gasabo", "Meeting room", [113, 69, null, 30, null, null, 36]],
    ["Akagera", "Meeting room", [43, 30, null, 21, null, null, 24]],
    ["Ingagi", "Meeting room", [32, 18, null, 15, null, null, 18]],
    ["Nyungwe", "Meeting room", [32, 30, null, 15, null, null, 18]],
    ["Karisimbi", "Meeting room", [113, 69, null, 30, null, null, 36]],
    ["Ubumwe", "Meeting room", [84, 48, null, 27, null, null, 30]],
    ["Amahoro", "Meeting room", [57, 33, null, 21, null, null, 24]],
    ["Garden", "Outdoor", [1000]], ["Village", "Outdoor"], ["Pavilion", "Conference hall", [1500]],
  ],
  "kigali-marriott-hotel": [
    ["Kilimanjaro Ballroom", "Ballroom", [500, 300, 500, 110, 500, 350]],
    ["Kilimanjaro 1", "Ballroom", [144, 90, 144, 36, 200, 100]],
    ["Kilimanjaro 2", "Ballroom", [192, 108, 192, 42, 200, 120]],
    ["Kilimanjaro 3", "Ballroom", [100, 32, 100, 24, 100, 70]],
    ["Rubavu", "Meeting room", [18, 12, 18, 12, 30, 20]],
    ["Nyungwe", "Meeting room", [18, 12, 18, 12, 30, 20]],
    ["Akagera", "Meeting room", [18, 12, 18, 12, 30, 20]],
    ["Muhazi", "Meeting room", [40, 27, 40, 18, 60, 40]],
    ["Virunga", "Meeting room", [54, 24, 54, 18, 40, 30]],
    ["Ruhondo", "Meeting room", [54, 24, 54, 24, 50, 30]],
    ["Seminar", "Meeting room", [123, 60, 123, 36, 70, 60]],
    ["Isaro", "Meeting room", [48, 24, 48, 24, 50, 40]],
    ["Boardroom", "Boardroom", [null, null, null, 20]],
    ["Malaika Gardens", "Outdoor", [null, null, null, null, 450, 280]],
    ["Ituze Gardens", "Outdoor", [null, null, null, null, 200, 100]],
    ["Kilimanjaro Foyer", "Foyer", [null, null, null, null, 250, 150]],
    ["Kilimanjaro Terrace", "Outdoor", [null, null, null, null, 200, 100]],
    ["Rubavu + Nyungwe + Akagera", "Meeting room", [90, 51, 90, 36, 90, 60]],
    ["Rubavu + Nyungwe", "Meeting room", [54, 30, 54, 24, 60, 40]],
    ["Muhazi + Virunga", "Meeting room", [90, 54, 90, 30, 70, 60]],
    ["Seminar + Isaro", "Meeting room", [195, 75, 195, null, 120, 100]],
    ["B1 Foyer", "Foyer", [null, null, null, null, 150, 100]],
  ],
  "kigali-serena-hotel": [
    ["The Ballroom", "Ballroom", [], 800], ["The Auditorium", "Conference hall", [], 500],
    ["Kivu Meeting Room", "Meeting room"], ["Muhazi Meeting Room", "Meeting room"],
    ["Burera Meeting Room", "Boardroom"], ["Imbehe Meeting Room", "Boardroom"],
  ],
  "four-points-kigali": [
    ["Simba Ballroom", "Ballroom", [200, 70, 200, 52, 200, 150]],
    ["Impala", "Meeting room", [null, null, null, 6]],
    ["Inyambo", "Meeting room", [null, null, null, 12]],
    ["Inzovu", "Meeting room", [null, null, null, 6]],
    ["Kinigi", "Meeting room", [40, 16, 40, 15, 40, 20]],
    ["Kivu", "Meeting room", [40, 16, 40, 14, 40, 20]],
    ["Muhabura", "Meeting room", [40, 16, 40, 10, 40, 20]],
    ["Gasabo", "Meeting room", [20, 12, 20, 6, 16, 10]],
    ["Inyange", "Meeting room", [null, null, null, 6]],
    ["Kinigi + Kivu", "Meeting room", [80, 40, 80, 32, 80, 50]],
    ["Muhabura + Gasabo", "Meeting room", [70, 28, 70, 28, 60, 40]],
  ],
  "park-inn-kigali": [
    ["Mkombozi Ballroom", "Ballroom"], ["Homeland Ballroom", "Ballroom"],
    ["Ballroom 1+2", "Ballroom", [], 400], ["Victory Gallery", "Meeting room"],
    ["Heroes Hall", "Meeting room"],
  ],
  "onomo-kigali": [["Meeting Room 1", "Meeting room", [], 80]],
};

export const meetingSpaces: MeetingSpace[] = Object.entries(inventory).flatMap(([venue, rooms]) =>
  rooms.map(([name, type, counts = [], publishedMaximum]) => ({
    id: name.toLowerCase().replaceAll("+", " plus ").replace(/[^a-z0-9]+/g, "-"),
    venue,
    name,
    type,
    capacities: Object.fromEntries(layouts.flatMap((layout, index) =>
      counts[index] ? [[layout, counts[index]]] : [],
    )),
    publishedMaximum,
  })),
);

export function meetingCapacity(space: MeetingSpace, layout?: Layout) {
  return layout
    ? space.capacities[layout] ?? 0
    : space.publishedMaximum ?? Math.max(0, ...Object.values(space.capacities));
}

export function filterMeetingSpaces({
  venue, query, type, layout, attendees,
}: {
  venue: string;
  query: string;
  type: string;
  layout: Layout | undefined;
  attendees: number;
}, catalog = { venues: meetingVenues, spaces: meetingSpaces }) {
  const text = query.toLowerCase().trim();
  const names = new Map(catalog.venues.map((item) => [item.slug, item.name]));
  return catalog.spaces.filter((space) => {
    if (venue && space.venue !== venue) return false;
    if (type && space.type !== type) return false;
    if (text && !`${names.get(space.venue)} ${space.name}`.toLowerCase().includes(text)) return false;
    return meetingCapacity(space, layout) >= (layout ? Math.max(1, attendees) : attendees);
  });
}
