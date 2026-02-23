"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlanSlideDeck } from "@/lib/plans/content";

function makeDeckDownloadHref(deck: PlanSlideDeck) {
  const json = JSON.stringify(deck, null, 2);
  return `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
}

export function StudySlidesPlayer(props: { deck: PlanSlideDeck; fileName: string }) {
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const slides = props.deck.slides;
  const total = slides.length;

  const safeIndex = Math.max(0, Math.min(index, total - 1));
  const current = slides[safeIndex];
  const downloadHref = useMemo(() => makeDeckDownloadHref(props.deck), [props.deck]);

  useEffect(() => {
    if (!autoplay || total <= 1) return undefined;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1 >= total ? 0 : prev + 1));
    }, 5000);

    return () => window.clearInterval(timer);
  }, [autoplay, total]);

  if (!current) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-muted/20 p-5">
        <div className="text-xs text-muted-foreground">
          Slide {safeIndex + 1} of {total}
        </div>
        <h3 className="mt-2 text-base font-semibold">{current.title}</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {current.content.map((point, pointIndex) => (
            <li key={`${point}-${pointIndex}`}>{point}</li>
          ))}
        </ul>
        {current.visual_suggestions ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Visual cue: <span className="font-medium text-foreground">{current.visual_suggestions}</span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setIndex((prev) => (prev <= 0 ? total - 1 : prev - 1))}
          disabled={total <= 1}
        >
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setIndex((prev) => (prev + 1 >= total ? 0 : prev + 1))}
          disabled={total <= 1}
        >
          Next
        </Button>
        <Button type="button" size="sm" onClick={() => setAutoplay((prev) => !prev)} disabled={total <= 1}>
          {autoplay ? "Stop autoplay" : "Autoplay"}
        </Button>
        <Button asChild type="button" size="sm" variant="ghost">
          <a href={downloadHref} download={props.fileName}>
            Download deck JSON
          </a>
        </Button>
      </div>
    </div>
  );
}
