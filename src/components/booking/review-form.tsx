"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangle, CheckCircle2, Star } from "lucide-react";
import { submitReview, type ReviewState } from "@/app/actions/review";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const initial: ReviewState = { status: "idle" };

/** Star picker that works without JS as a plain radio group. */
export function ReviewForm({ reference }: { reference: string }) {
  const [state, action, pending] = useActionState(submitReview, initial);
  const [rating, setRating] = React.useState(0);
  const [hovered, setHovered] = React.useState(0);

  if (state.status === "success") {
    return (
      <div className="rounded-[var(--radius-card)] border border-forest-300 bg-forest-100 p-6 text-center">
        <CheckCircle2 className="mx-auto size-8 text-forest-600" />
        <h2 className="mt-4 text-xl text-forest-900">Thank you</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-forest-800/80">
          Your review is with our team and will appear on the listing once
          it&rsquo;s approved.
        </p>
      </div>
    );
  }

  const shown = hovered || rating;

  return (
    <form
      action={action}
      className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--paper-raised)] p-6"
    >
      <input type="hidden" name="reference" value={reference} />

      <h2 className="text-lg">Leave a review</h2>
      <p className="mt-1.5 text-2xs leading-relaxed text-[var(--ink-faint)]">
        Only travellers who completed this trip can review it.
      </p>

      {state.status === "error" && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-[var(--radius-inset)] border border-red-200 bg-red-50 p-3.5 text-2xs leading-relaxed text-red-900"
        >
          <AlertTriangle className="mt-px size-4 shrink-0" />
          {state.message}
        </p>
      )}

      <fieldset className="mt-5">
        <legend className="text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
          Rating
        </legend>
        <div
          className="mt-2.5 flex items-center gap-1"
          onMouseLeave={() => setHovered(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              onMouseEnter={() => setHovered(n)}
              className="cursor-pointer p-0.5"
            >
              <input
                type="radio"
                name="rating"
                value={n}
                required
                checked={rating === n}
                onChange={() => setRating(n)}
                className="sr-only"
              />
              <span className="sr-only">{n} out of 5</span>
              <Star
                aria-hidden
                className={cn(
                  "size-7 transition-colors",
                  n <= shown
                    ? "fill-sun-500 text-sun-700"
                    : "text-[var(--line-strong)]",
                )}
              />
            </label>
          ))}
          {rating > 0 && (
            <span className="tnum ml-2 text-sm text-[var(--ink-muted)]">
              {rating}/5
            </span>
          )}
        </div>
      </fieldset>

      <label className="mt-5 flex flex-col gap-1.5">
        <span className="text-2xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
          Comment (optional)
        </span>
        <textarea
          name="comment"
          rows={4}
          placeholder="What went well? What should the next traveller know?"
          className="w-full resize-y rounded-[var(--radius-inset)] border border-[var(--line-strong)] bg-transparent px-4 py-3 text-sm leading-relaxed outline-none focus-visible:border-lake-600"
        />
      </label>

      <Button
        type="submit"
        variant="accent"
        className="mt-5 w-full"
        disabled={pending || rating === 0}
      >
        {pending ? "Sending…" : "Submit review"}
      </Button>
    </form>
  );
}
