"use client";

import { SELECT_ROOM_EVENT } from "@/components/booking/booking-panel";

// Lives in the room list; tells the booking panel which room to book instead of leaving it on the cheapest.
export function ChooseRoomButton({ roomId, roomName }: { roomId: string; roomName: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(SELECT_ROOM_EVENT, { detail: roomId }))}
      aria-label={`Choose ${roomName}`}
      className="mt-3 inline-flex items-center rounded-full border border-[var(--line-strong)] px-4 py-1.5 text-2xs font-medium transition-colors hover:border-forest-800 hover:bg-forest-800 hover:text-bone-50"
    >
      Choose this room
    </button>
  );
}
