"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type TypeAheadOption = { value: string; label: string; hint?: string };

/**
 * A text field that suggests matches only once something is typed, instead of
 * a long dropdown of every area. Picking a suggestion sets `value`; leaving
 * the field on an exact match picks it too.
 */
export function TypeAhead({
  options,
  value,
  onChange,
  placeholder,
  className,
  /** Always offered last while typing, e.g. "Somewhere else — we'll quote". */
  fallback,
  max = 8,
  "aria-label": ariaLabel,
}: {
  options: TypeAheadOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  fallback?: TypeAheadOption;
  max?: number;
  "aria-label"?: string;
}) {
  const listId = React.useId();
  const selected = options.find((o) => o.value === value) ?? (fallback?.value === value ? fallback : undefined);
  const [text, setText] = React.useState(selected?.label ?? "");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);

  // A choice made elsewhere (a reset, the swap button) shows in the field.
  const [shown, setShown] = React.useState(value);
  if (shown !== value) {
    setShown(value);
    setText(selected?.label ?? "");
  }

  const q = text.trim().toLowerCase();
  const matches = q
    ? options
        .filter((o) => o.label.toLowerCase().includes(q))
        // Names that start with what was typed come first.
        .sort((a, b) => Number(!a.label.toLowerCase().startsWith(q)) - Number(!b.label.toLowerCase().startsWith(q)))
        .slice(0, max)
    : [];
  const items = q && fallback ? [...matches, fallback] : matches;

  function pick(o: TypeAheadOption) {
    setText(o.label);
    setOpen(false);
    onChange(o.value);
  }

  function leave() {
    setOpen(false);
    if (selected && selected.label === text) return;
    const exact = options.find((o) => o.label.toLowerCase() === q);
    if (exact) pick(exact);
    else if (value) onChange("");
  }

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
          if (value) onChange("");
        }}
        onFocus={() => q && setOpen(true)}
        onBlur={leave}
        onKeyDown={(e) => {
          if (!open || items.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % items.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + items.length) % items.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(items[active]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={className}
      />
      {open && items.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          // Fixed light colours: over the dark homepage hero the theme tokens turn green.
          className="absolute left-0 top-full z-50 mt-2 max-h-80 w-full min-w-[16rem] overflow-y-auto rounded-[var(--radius-inset)] border border-bone-200 bg-bone-50 py-1 text-left shadow-[var(--shadow-float)]"
        >
          {items.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: the field's blur would close the list first.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2.5 text-sm",
                i === active && "bg-bone-100",
                o === fallback && "border-t border-bone-200",
              )}
            >
              <span className={cn("font-medium", o === fallback ? "text-bone-600" : "text-bone-900")}>{o.label}</span>
              {o.hint ? <span className="shrink-0 text-2xs text-bone-500">{o.hint}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
