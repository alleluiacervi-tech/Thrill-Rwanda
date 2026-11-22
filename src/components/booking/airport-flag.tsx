import { airportCountry } from "@/lib/flight-geography";
import { CountryFlag } from "./flight-marks";

export function AirportFlag({ value }: { value: string }) {
  return <CountryFlag country={airportCountry(value)} />;
}
