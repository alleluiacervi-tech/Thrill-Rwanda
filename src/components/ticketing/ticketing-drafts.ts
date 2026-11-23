import type { OptionDraft, SegmentDraft } from "./ticketing-forms";

/** Kigali is UTC+2 all year, so the stored instant maps to a fixed offset for the editor. */
const isoToKigali = (iso: string) => (iso ? new Date(new Date(iso).getTime() + 2 * 3_600_000).toISOString().slice(0, 16) : "");

export const optionDraftFromRow = (o: {
  label: string; currency: string; totalMinor: number; fareBasis: string; baggage: string; changeRule: string; refundRule: string; validUntil: Date;
  segments: SegmentDraft[];
}): OptionDraft => ({
  label: o.label, currency: o.currency, total: o.currency === "RWF" ? String(o.totalMinor) : (o.totalMinor / 100).toFixed(2),
  fareBasis: o.fareBasis, baggage: o.baggage, changeRule: o.changeRule, refundRule: o.refundRule, validUntil: isoToKigali(o.validUntil.toISOString()),
  segments: o.segments.map((s) => ({ airline: s.airline, flightNumber: s.flightNumber, origin: s.origin, destination: s.destination, departLocal: s.departLocal, arriveLocal: s.arriveLocal, cabin: s.cabin, bookingClass: s.bookingClass, terminal: s.terminal })),
});

