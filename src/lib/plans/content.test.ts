import { describe, expect, it } from "vitest";
import {
  getPlanItemLessonAssets,
  getPlanItemLesson,
  getPlanItemResourceLinks,
  normalizePlanLesson,
  type PlanLesson,
  withPlanItemLessonAssets,
  withPlanItemLesson
} from "@/lib/plans/content";

function makeLesson(): PlanLesson {
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
    visual_aids: [
      {
        kind: "graph",
        title: "Mastery chart",
        explanation: "Shows confidence by subtopic.",
        alt_text: "Bar chart for topic mastery by subtopic.",
        prompt: "Create a simple bar chart for learner mastery.",
        bullets: ["Lower bars indicate weak areas."],
        points: [
          { label: "Definition", value: 40 },
          { label: "Application", value: 65 },
          { label: "Exam traps", value: 52 }
        ]
      }
    ],
    generated_at: "2026-02-20T00:00:00.000Z",
    source: "ai",
    provider: "openai",
    model: "gpt-4o-mini"
  };
}

describe("plan content helpers", () => {
  it("parses legacy array resource links", () => {
    const links = getPlanItemResourceLinks([
      { title: "Lesson notes", url: "https://example.com/notes/lexis" },
      { title: "Invalid", url: "javascript:alert(1)" }
    ]);

    expect(links).toHaveLength(1);
    expect(links[0]?.title).toBe("Lesson notes");
  });

  it("extracts lesson from envelope payload", () => {
    const payload = {
      resources: [{ title: "Lesson notes", url: "https://example.com/notes" }],
      lesson: makeLesson()
    };

    const lesson = getPlanItemLesson(payload);
    expect(lesson?.source).toBe("ai");
    expect(lesson?.breakdown.length).toBe(2);
  });

  it("stores lesson while preserving resources", () => {
    const payload = withPlanItemLesson(
      [{ title: "Lesson notes", url: "https://example.com/notes/structure" }],
      makeLesson()
    ) as any;

    expect(Array.isArray(payload.resources)).toBe(true);
    expect(payload.resources).toHaveLength(1);
    expect(payload.lesson.overview).toContain("Lexis and structure");
  });

  it("extracts and stores study assets in envelope payload", () => {
    const base = withPlanItemLesson([], makeLesson());
    const payload = withPlanItemLessonAssets(base, {
      selected_format: "audio",
      audio: {
        narration: "Read this topic summary before the quiz.",
        generated_at: "2026-02-20T00:00:00.000Z",
        source: "derived",
        provider: null,
        model: null
      },
      slides: null
    }) as any;

    const assets = getPlanItemLessonAssets(payload);
    expect(assets.selected_format).toBe("audio");
    expect(assets.audio?.source).toBe("derived");
    expect(assets.slides).toBeNull();
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
