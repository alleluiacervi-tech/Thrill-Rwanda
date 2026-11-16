import {
  Armchair,
  Backpack,
  Banknote,
  BedDouble,
  Binoculars,
  BookOpen,
  Building2,
  Bus,
  CalendarCheck,
  Car,
  Coffee,
  Compass,
  Flower2,
  GraduationCap,
  Handshake,
  Heart,
  Hotel,
  IdCard,
  Landmark,
  Leaf,
  Map as MapIcon,
  Mountain,
  Music,
  Palette,
  Plane,
  ShieldCheck,
  Sparkles,
  Sunset,
  Ticket,
  Trees,
  Users,
  Utensils,
  Waves,
  Wine,
  type LucideIcon,
} from "lucide-react";

/**
 * Icons by name, so the product map in src/lib/journeys.ts stays plain data
 * that the client header can import without pulling in components.
 */
const icons: Record<string, LucideIcon> = {
  armchair: Armchair,
  backpack: Backpack,
  banknote: Banknote,
  bed: BedDouble,
  binoculars: Binoculars,
  book: BookOpen,
  building: Building2,
  bus: Bus,
  calendar: CalendarCheck,
  car: Car,
  coffee: Coffee,
  compass: Compass,
  flower: Flower2,
  graduation: GraduationCap,
  handshake: Handshake,
  heart: Heart,
  hotel: Hotel,
  id: IdCard,
  landmark: Landmark,
  leaf: Leaf,
  map: MapIcon,
  mountain: Mountain,
  music: Music,
  palette: Palette,
  plane: Plane,
  shield: ShieldCheck,
  sparkles: Sparkles,
  sunset: Sunset,
  ticket: Ticket,
  trees: Trees,
  users: Users,
  utensils: Utensils,
  waves: Waves,
  wine: Wine,
};

export function JourneyIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = icons[name] ?? Compass;
  return <Icon className={className} aria-hidden />;
}
