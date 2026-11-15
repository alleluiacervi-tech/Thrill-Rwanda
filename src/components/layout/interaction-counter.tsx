"use client";
import { useEffect } from "react";
import { interactionSchema } from "@/lib/launch-rules";
export function InteractionCounter() {
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const el = event.target.closest<HTMLElement>(
        "[data-service][data-placement]",
      );
      if (!el) return;
      const value = interactionSchema.safeParse({
        service: el.dataset.service,
        placement: el.dataset.placement,
      });
      if (value.success)
        navigator.sendBeacon?.(
          "/api/interactions",
          new Blob([JSON.stringify(value.data)], { type: "application/json" }),
        );
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  return null;
}
