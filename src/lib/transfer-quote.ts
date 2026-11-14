import { db } from "@/lib/db";
import {
  pickupPoint,
  quoteZoneTrip,
  splitAreas,
  tripEnds,
  vehicle as vehicleByKey,
  type VehicleKey,
  type ZoneQuote,
} from "@/lib/transfer-zones-shared";

export type ZoneTripInput = {
  point: string;
  zoneId: string;
  area: string;
  /** "from": collected at the pickup point; "to": dropped there. */
  direction: "from" | "to";
  vehicle: VehicleKey;
  passengers: number;
  time: string;
};

export type PricedTrip = ZoneQuote & {
  pickup: string;
  dropoff: string;
  zoneName: string;
  vehicleLabel: string;
};

/**
 * Prices a trip from the admin's zone table, on the server.
 *
 * The browser only says which point, zone, area and vehicle; the price is
 * looked up again here, so it can't be edited into a cheaper trip.
 */
export async function priceZoneTrip(input: ZoneTripInput): Promise<PricedTrip | { error: string }> {
  const point = pickupPoint(input.point);
  const v = vehicleByKey(input.vehicle);
  if (!point || !v) return { error: "Choose where we meet you and a vehicle." };
  if (input.passengers > v.seats) return { error: `A ${v.label.toLowerCase()} takes ${v.seats}. Pick a bigger vehicle.` };

  const zone = await db.transferZone.findFirst({ where: { id: input.zoneId, isActive: true } });
  // The area must belong to the zone, or a cheap zone could be paired with a far-off area.
  if (!zone || zone.origin !== point.table || !splitAreas(zone.areas).includes(input.area)) {
    return { error: "That area isn't on our price list any more. Pick it again, or send it as a request." };
  }

  const fromPoint = input.direction === "from";
  const quote = quoteZoneTrip({ zone, vehicle: v.key, point, fromPoint, time: input.time });
  const [pickup, dropoff] = tripEnds(point, input.area, fromPoint);

  return { ...quote, pickup, dropoff, zoneName: zone.name, vehicleLabel: v.label };
}
