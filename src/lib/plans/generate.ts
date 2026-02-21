import { addDays, differenceInCalendarDays, formatISO, isValid, parseISO } from "date-fns";
import type { Topic } from "@/lib/syllabi/fallback";

export type Pace = "steady" | "intensive";

export type GeneratedPlanItem = {
  scheduled_for: string; // YYYY-MM-DD
  day_index: number;
  topic_path: string;
  title: string;
  resource_links: Array<{ title: string; url: string }>;
};

function defaultResourcesFor(subject: string) {
  const q = encodeURIComponent(`${subject} basics`);
  return [
    { title: "YouTube (search)", url: `https://www.youtube.com/results?search_query=${q}` }
  ];
}

export function generatePlanItemsFromTopics(args: {
  topics: Topic[];
  pace: Pace;
  startDate: string; // YYYY-MM-DD
  targetDate?: string | null; // YYYY-MM-DD
}): GeneratedPlanItem[] {
  const { topics, pace, startDate, targetDate } = args;
  const defaultPerDay = pace === "intensive" ? 2 : 1;
  const start = parseISO(startDate);
  const target = targetDate ? parseISO(targetDate) : null;
  const hasValidWindow = Boolean(target && isValid(target) && isValid(start) && target >= start);

  let perDay = defaultPerDay;
  if (hasValidWindow && target) {
    const windowDays = Math.max(1, differenceInCalendarDays(target, start) + 1);
    const requiredPerDay = Math.ceil(topics.length / windowDays);
    perDay = Math.max(defaultPerDay, requiredPerDay);
  }

  const items: GeneratedPlanItem[] = [];

  let dayIndex = 0;
  for (let i = 0; i < topics.length; i += perDay) {
    const dayTopics = topics.slice(i, i + perDay);
    const date = addDays(start, dayIndex);
    const scheduled_for = formatISO(date, { representation: "date" });
    for (const t of dayTopics) {
      items.push({
        scheduled_for,
        day_index: dayIndex,
        topic_path: t.path,
        title: t.title,
        resource_links: t.resources?.length ? t.resources : defaultResourcesFor(t.title)
      });
    }
    dayIndex += 1;
  }

  return items;
}

