"use client";

import * as React from "react";
import { Eraser } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Draw-your-signature box.
 *
 * Pointer events, so a finger on a phone and a mouse on a laptop behave the
 * same. The drawing is written into a hidden field as a PNG data URL when the
 * form submits — there is no upload step, so a flaky connection can't lose a
 * signature halfway through.
 */
export function SignaturePad({
  name,
  label = "Sign here",
  onChange,
}: {
  name: string;
  label?: string;
  /** Called when the drawing starts or is cleared, for enabling the submit. */
  onChange?: (hasInk: boolean) => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const drawing = React.useRef(false);
  const [hasInk, setHasInk] = React.useState(false);

  // Match the backing store to the element's real size, or lines sit off the pointer.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      // Resizing clears the canvas, so a signature in progress is redrawn from the field.
      const existing = inputRef.current?.value;
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1a1a1a";
      if (existing) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = existing;
      }
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) {
      setHasInk(true);
      onChange?.(true);
    }
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas || !inputRef.current) return;
    inputRef.current.value = canvas.toDataURL("image/png");
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (inputRef.current) inputRef.current.value = "";
    setHasInk(false);
    onChange?.(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
          {label}
        </span>
        {hasInk ? (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 text-2xs text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            <Eraser className="size-3.5" />
            Clear
          </button>
        ) : null}
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        aria-label={label}
        className={cn(
          "mt-1.5 block h-40 w-full touch-none rounded-[var(--radius-inset)] border-2 border-dashed bg-[var(--paper-raised)]",
          hasInk ? "border-forest-800" : "border-[var(--line-strong)]",
        )}
      />

      <input ref={inputRef} type="hidden" name={name} />

      <p className="mt-1.5 text-2xs text-[var(--ink-faint)]">
        Draw with your finger, a stylus or the mouse.
      </p>
    </div>
  );
}
