export const airlines = {
  WB: "RwandAir", ET: "Ethiopian Airlines", KQ: "Kenya Airways", UR: "Uganda Airlines",
  TC: "Air Tanzania", MS: "EgyptAir", QR: "Qatar Airways", EK: "Emirates",
  FZ: "flydubai", TK: "Turkish Airlines", SN: "Brussels Airlines", KL: "KLM",
  AF: "Air France", BA: "British Airways", LH: "Lufthansa", LX: "Swiss International Air Lines",
} as const;

export function isAirlineCode(value: unknown): value is keyof typeof airlines {
  return typeof value === "string" && Object.hasOwn(airlines, value);
}
