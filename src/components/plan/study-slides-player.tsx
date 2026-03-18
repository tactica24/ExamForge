"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlanSlideDeck } from "@/lib/plans/content";

function graphBarWidth(value: number, maxAbs: number) {
  const safeMax = Math.max(1, Math.abs(maxAbs));
  const ratio = Math.abs(value) / safeMax;
  return `${Math.max(8, Math.round(ratio * 100))}%`;
}

export function StudySlidesPlayer(props: {
  deck: PlanSlideDeck;
  downloadUrl?: string;
  downloadFileName?: string;
}) {
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const slides = props.deck.slides;
  const total = slides.length;

  const safeIndex = Math.max(0, Math.min(index, total - 1));
  const current = slides[safeIndex];

  useEffect(() => {
    if (!autoplay || total <= 1) return undefined;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1 >= total ? 0 : prev + 1));
    }, 5000);

    return () => window.clearInterval(timer);
  }, [autoplay, total]);

  if (!current) return null;
  const visual = current.visual;
  const visualMax = visual?.points.length ? Math.max(1, ...visual.points.map((entry) => Math.abs(entry.value))) : 1;

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

        {visual ? (
          <div className="mt-4 rounded-lg border border-border/70 bg-card/70 p-3">
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {visual.kind}
            </div>
            <div className="mt-1 text-sm font-medium">{visual.title}</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{visual.explanation}</p>

            {visual.points.length ? (
              <div className="mt-3 space-y-2">
                {visual.points.map((point) => (
                  <div key={`${visual.title}-${point.label}`} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{point.label}</span>
                      <span>{point.value}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted/70">
                      <div className="h-full rounded-full bg-primary/80" style={{ width: graphBarWidth(point.value, visualMax) }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {visual.bullets.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
                {visual.bullets.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
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
        {props.downloadUrl ? (
          <Button asChild type="button" size="sm" variant="ghost">
            <a href={props.downloadUrl} download={props.downloadFileName ?? "study-slides.pptx"}>
              Download PPT
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
