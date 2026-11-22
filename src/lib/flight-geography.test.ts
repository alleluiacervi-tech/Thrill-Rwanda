import { expect, it } from "vitest";
import { airportCountry, airportSuggestions } from "./flight-geography";

it.each([
  ["Addis", "ET"], ["Addis Ababa", "ET"], ["KGL", "RW"], ["Nairobi (NBO)", "KE"],
  ["Johannesburg", "ZA"], ["Sydney (SYD)", "AU"], ["São Paulo (GRU)", "BR"],
  ["Not an airport", undefined], ["London", undefined],
])("resolves the flag for %s", (value, country) => {
  expect(airportCountry(value as string)).toBe(country);
});

it("offers airports in multiple countries for an ambiguous city", () => {
  const matches = airportSuggestions("London");
  expect(matches.some(row => row.code === "LHR" && row.country === "GB")).toBe(true);
  expect(matches.some(row => row.code === "YXU" && row.country === "CA")).toBe(true);
});
