import { addDays, differenceInCalendarDays, formatISO, isValid, parseISO } from "date-fns";
import type { Topic } from "@/lib/syllabi/fallback";
import { parseTopicsPerDay } from "@/lib/plans/pace";

export type Pace = "steady" | "intensive" | string;
const SUBTOPICS_PER_ITEM = 2;

export type GeneratedPlanItem = {
  scheduled_for: string; // YYYY-MM-DD
  day_index: number;
  topic_path: string;
  title: string;
  resource_links: Array<{ title: string; url: string }>;
};

type TopicUnit = {
  topic_path: string;
  title: string;
};

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeSubtopics(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => cleanText(entry, 80))
    .filter(Boolean)
    .filter((entry, index, all) => all.indexOf(entry) === index);
}

function focusTitle(topicTitle: string, subtopics: string[]) {
  const base = cleanText(topicTitle, 140) || "Topic";
  if (!subtopics.length) return base;
  return cleanText(`${base} (Focus: ${subtopics.join(" + ")})`, 180) || base;
}

function toTopicUnits(topics: Topic[]): TopicUnit[] {
  const out: TopicUnit[] = [];

  for (const topic of topics) {
    const topicPath = cleanText(topic.path || topic.title, 180) || cleanText(topic.title, 180) || "Topic";
    const topicTitle = cleanText(topic.title || topic.path, 180) || topicPath;
    const subtopics = normalizeSubtopics(topic.subtopics);

    if (!subtopics.length) {
      out.push({
        topic_path: topicPath,
        title: topicTitle
      });
      continue;
    }

    for (let i = 0; i < subtopics.length; i += SUBTOPICS_PER_ITEM) {
      const focus = subtopics.slice(i, i + SUBTOPICS_PER_ITEM);
      out.push({
        topic_path: topicPath,
        title: focusTitle(topicTitle, focus)
      });
    }
  }

  return out;
}

export function generatePlanItemsFromTopics(args: {
  topics: Topic[];
  pace: Pace;
  startDate: string; // YYYY-MM-DD
  targetDate?: string | null; // YYYY-MM-DD
}): GeneratedPlanItem[] {
  const { pace, startDate, targetDate } = args;
  const topicUnits = toTopicUnits(args.topics);
  const defaultPerDay = parseTopicsPerDay(pace, 1);
  const start = parseISO(startDate);
  const target = targetDate ? parseISO(targetDate) : null;
  const hasValidWindow = Boolean(target && isValid(target) && isValid(start) && target >= start);

  let perDay = defaultPerDay;
  if (hasValidWindow && target) {
    const windowDays = Math.max(1, differenceInCalendarDays(target, start) + 1);
    const requiredPerDay = Math.ceil(topicUnits.length / windowDays);
    perDay = Math.max(defaultPerDay, requiredPerDay);
  }

  const items: GeneratedPlanItem[] = [];

  let dayIndex = 0;
  for (let i = 0; i < topicUnits.length; i += perDay) {
    const dayTopics = topicUnits.slice(i, i + perDay);
    const date = addDays(start, dayIndex);
    const scheduled_for = formatISO(date, { representation: "date" });
    for (const t of dayTopics) {
      items.push({
        scheduled_for,
        day_index: dayIndex,
        topic_path: t.topic_path,
        title: t.title,
        resource_links: []
      });
    }
    dayIndex += 1;
  }

  return items;
}

