import airports from "@/data/flight-airports.json";

const normalize = (text: string) => text.trim().normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const regions = new Intl.DisplayNames(["en"], { type: "region" });
const byCode = new Map<string, string>();
const byCity = new Map<string, string | null>();
const byCountryName = new Map<string, string>();
const entries = airports.map(([code, city, country]) => {
  const key = normalize(city);
  byCode.set(code, country);
  byCity.set(key, !byCity.has(key) || byCity.get(key) === country ? country : null);
  return { code, city, country, key };
});
for (const country of new Set(byCode.values()))
  byCountryName.set(normalize(regions.of(country) ?? country), country);

export function airportCountry(input: string) {
  const key = normalize(input);
  const code = key.match(/\(([a-z]{3})\)$/)?.[1] ?? key;
  if (key === "addis") return "ET";
  return byCode.get(code.toUpperCase()) ?? byCity.get(key) ?? byCountryName.get(key);
}

export function airportSuggestions(input: string) {
  const term = normalize(input);
  if (term.length < 2 || term.endsWith(")")) return [];
  const matches = [];
  const exact = entries.find(entry => entry.code.toLowerCase() === term);
  if (exact) matches.push(exact);
  for (const entry of entries) {
    if (entry !== exact && (entry.key.startsWith(term) || entry.code.toLowerCase().startsWith(term)))
      matches.push(entry);
    if (matches.length === 10) break;
  }
  return matches;
}

export function countryName(code: string) {
  return regions.of(code) ?? code;
}
