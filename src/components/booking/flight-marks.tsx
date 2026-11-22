import Image from "next/image";
import { airlines } from "@/lib/flight-airlines";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export function CountryFlag({ country }: { country?: string }) {
  if (!country) return null;
  const name = regionNames.of(country) ?? country;
  return <Image src={`/media/flags/${country.toLowerCase()}.svg`} alt={name} title={name}
    width={20} height={15} unoptimized className="inline-block h-[15px] w-5 shrink-0 rounded-[2px] align-middle ring-1 ring-black/10" />;
}

export function AirlineLogo({ code }: { code: keyof typeof airlines }) {
  return <Image src={`/media/airlines/${code}.svg`} alt={airlines[code]} width={115} height={32}
    unoptimized className="inline-block h-7 w-28 object-contain object-left" />;
}
