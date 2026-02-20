import { describe, expect, it } from "vitest";
import {
  getPlanItemLesson,
  getPlanItemResourceLinks,
  normalizePlanLesson,
  withPlanItemLesson
} from "@/lib/plans/content";

function makeLesson() {
  return {
    overview: "Lexis and structure helps you choose the right words and grammar for each sentence.",
    breakdown: [
      { heading: "Definition", explanation: "Lexis focuses on word choice while structure focuses on grammar." },
      { heading: "Exam focus", explanation: "Questions test meaning accuracy and grammar correctness together." }
    ],
    examples: [
      {
        question: "Choose the best word for a sentence context.",
        walkthrough: "Read the full sentence and remove options that do not fit the meaning.",
        answer: "Pick the option that fits both grammar and meaning."
      }
    ],
    common_mistakes: ["Ignoring context clues in nearby words."],
    recap: ["Read the full sentence before selecting an option."],
    generated_at: "2026-02-20T00:00:00.000Z",
    source: "ai",
    provider: "openai",
    model: "gpt-4o-mini"
  } as const;
}

describe("plan content helpers", () => {
  it("parses legacy array resource links", () => {
    const links = getPlanItemResourceLinks([
      { title: "YouTube", url: "https://www.youtube.com/results?search_query=lexis" },
      { title: "Invalid", url: "javascript:alert(1)" }
    ]);

    expect(links).toHaveLength(1);
    expect(links[0]?.title).toBe("YouTube");
  });

  it("extracts lesson from envelope payload", () => {
    const payload = {
      resources: [{ title: "Khan Academy", url: "https://www.khanacademy.org" }],
      lesson: makeLesson()
    };

    const lesson = getPlanItemLesson(payload);
    expect(lesson?.source).toBe("ai");
    expect(lesson?.breakdown.length).toBe(2);
  });

  it("stores lesson while preserving resources", () => {
    const payload = withPlanItemLesson(
      [{ title: "YouTube", url: "https://www.youtube.com/results?search_query=structure" }],
      makeLesson()
    ) as any;

    expect(Array.isArray(payload.resources)).toBe(true);
    expect(payload.resources).toHaveLength(1);
    expect(payload.lesson.overview).toContain("Lexis and structure");
  });

  it("rejects incomplete lesson objects", () => {
    const invalid = normalizePlanLesson({
      overview: "Too short",
      breakdown: [],
      examples: [],
      common_mistakes: [],
      recap: []
    });

    expect(invalid).toBeNull();
  });
});
