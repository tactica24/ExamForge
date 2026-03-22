import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generateJsonWithFallback = vi.fn();

vi.mock("@/lib/ai/multi", () => ({
  generateJsonWithFallback
}));

vi.mock("@/lib/ai/language", () => ({
  languageInstruction: vi.fn(() => "Respond in English.")
}));

import { generateQuestions } from "@/lib/quizzes/questions";

function makeQuestion(seed: string) {
  return {
    question: `${seed} question`,
    options: [`${seed} A`, `${seed} B`, `${seed} C`, `${seed} D`],
    correct_index: 0,
    explanation: `${seed} explanation`
  };
}

describe("generateQuestions", () => {
  it("rejects partial AI output so later fallback logic can supply a full quiz", async () => {
    generateJsonWithFallback.mockImplementation(async (args: any) => {
      const partial = { questions: [makeQuestion("partial")] };
      const validated = args.validate?.(partial) ?? null;
      return {
        value: validated,
        rawText: JSON.stringify(partial),
        provider: validated ? "groq" : null,
        model: validated ? "llama-3.3-70b-versatile" : null,
        error: validated ? null : "provider returned too few questions"
      };
    });

    const result = await generateQuestions({
      examName: "WAEC",
      subject: "Biology",
      topic: "Cell structure",
      count: 4,
      preferredLanguage: "en"
    });

    expect(result).toHaveLength(4);
    expect(result.some((question) => question.question === "partial question")).toBe(false);
  });

  it("keeps full valid AI output when the requested count is satisfied", async () => {
    generateJsonWithFallback.mockImplementation(async (args: any) => {
      const full = {
        questions: [makeQuestion("one"), makeQuestion("two"), makeQuestion("three")]
      };
      return {
        value: args.validate?.(full) ?? null,
        rawText: JSON.stringify(full),
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        error: null
      };
    });

    const result = await generateQuestions({
      examName: "JAMB",
      subject: "Chemistry",
      topic: "Atomic structure",
      count: 3,
      preferredLanguage: "en"
    });

    expect(result).toHaveLength(3);
    expect(result.map((question) => question.question)).toEqual([
      "one question",
      "two question",
      "three question"
    ]);
  });
});
