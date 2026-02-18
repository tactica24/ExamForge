"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";

type Story = {
  name: string;
  exam: string;
  text: string;
  tone: string;
};

const stories: Story[] = [
  {
    name: "Temitope",
    exam: "JAMB",
    text: "This is the best app. It helped me plan my exams daily and fixed my weak topics quickly.",
    tone: "from-emerald-600 to-teal-500"
  },
  {
    name: "Felix",
    exam: "WAEC",
    text: "The objective questions and instant explanations made revision clear. My confidence jumped fast.",
    tone: "from-blue-600 to-cyan-500"
  },
  {
    name: "Amina",
    exam: "NECO",
    text: "I stopped guessing in Mathematics because each practice round showed the correct method immediately.",
    tone: "from-orange-500 to-amber-500"
  },
  {
    name: "Chinedu",
    exam: "IELTS",
    text: "The study plan kept me consistent and the feedback after each session saved me from repeating mistakes.",
    tone: "from-fuchsia-600 to-pink-500"
  }
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((piece) => piece[0]?.toUpperCase())
    .join("");
}

export function SuccessStoriesSlider() {
  const [index, setIndex] = React.useState(0);
  const [animated, setAnimated] = React.useState(true);
  const total = stories.length;
  const visibleCount = 2;
  const slides = React.useMemo(() => [...stories, ...stories.slice(0, visibleCount)], []);

  React.useEffect(() => {
    if (!total) return;
    const timer = setInterval(() => setIndex((value) => value + 1), 4200);
    return () => clearInterval(timer);
  }, [total]);

  React.useEffect(() => {
    if (index < total) return;
    const t = setTimeout(() => {
      setAnimated(false);
      setIndex(0);
    }, 700);
    return () => clearTimeout(t);
  }, [index, total]);

  React.useEffect(() => {
    if (animated) return;
    const raf = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(raf);
  }, [animated]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-muted/40 p-3 sm:p-4">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-card to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-card to-transparent" />
      <div
        className={["flex gap-3", animated ? "transition-transform duration-700 ease-out" : ""].join(" ")}
        style={{ transform: `translateX(-${index * (100 / visibleCount)}%)` }}
      >
        {slides.map((story, idx) => (
          <Card key={`${story.name}-${idx}`} className="w-1/2 shrink-0 rounded-xl border bg-background/85 p-4">
            <div className="flex items-center gap-3">
              <div
                className={[
                  "flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white",
                  story.tone
                ].join(" ")}
              >
                {initials(story.name)}
              </div>
              <div>
                <div className="text-sm font-semibold">{story.name}</div>
                <div className="text-xs text-muted-foreground">{story.exam} candidate</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{story.text}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
