import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generateJsonWithFallback = vi.fn();

vi.mock("@/lib/ai/multi", () => ({
  generateJsonWithFallback
}));

vi.mock("@/lib/ai/language", () => ({
  languageInstruction: vi.fn(() => "Respond in English.")
}));

import { fallbackQuestions, generateQuestions, isPlaceholderQuestion } from "@/lib/quizzes/questions";

function makeQuestion(seed: string) {
  return {
    question: `${seed} question`,
    options: [`${seed} A`, `${seed} B`, `${seed} C`, `${seed} D`],
    correct_index: 0,
    explanation: `${seed} explanation`
  };
}

describe("generateQuestions", () => {
  it("keeps valid partial AI output and tops up the quiz with stronger fallback items", async () => {
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
    expect(result.some((question) => question.question === "partial question")).toBe(true);
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

  it("accumulates valid questions across multiple AI batches before using fallback", async () => {
    const queue = [
      { questions: [makeQuestion("alpha"), makeQuestion("beta")] },
      { questions: [makeQuestion("gamma"), makeQuestion("delta")] }
    ];

    generateJsonWithFallback.mockImplementation(async (args: any) => {
      const next = queue.shift() ?? { questions: [] };
      return {
        value: args.validate?.(next) ?? null,
        rawText: JSON.stringify(next),
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        error: null
      };
    });

    const result = await generateQuestions({
      examName: "WAEC",
      subject: "Biology",
      topic: "Cell structure",
      count: 4,
      preferredLanguage: "en",
      syllabus: ["Cell structure", "Cell membrane", "Mitochondrion", "Nucleus"]
    });

    expect(result).toHaveLength(4);
    expect(result.map((question) => question.question)).toEqual([
      "alpha question",
      "beta question",
      "gamma question",
      "delta question"
    ]);
  });

  it("flags the bad generic structure reported in quiz output", () => {
    expect(
      isPlaceholderQuestion({
        question: "All the following are associated with cell structure and function except _____.",
        options: [
          "Its common exam application pattern.",
          "Typical misconceptions linked to the concept.",
          "An unrelated idea outside the focus concept.",
          "Its core rule in practice: biology."
        ]
      })
    ).toBe(true);
  });

  it("produces non-generic fallback questions for social science subjects", () => {
    const result = fallbackQuestions({
      examName: "WAEC",
      subject: "Government",
      topic: "Arms of government",
      count: 4,
      syllabus: ["Legislature", "Executive", "Judiciary", "Separation of powers"]
    });

    expect(result).toHaveLength(4);
    expect(result.every((question) => !isPlaceholderQuestion(question))).toBe(true);
  });

  it("produces non-generic fallback questions for business subjects", () => {
    const result = fallbackQuestions({
      examName: "WAEC",
      subject: "Financial Accounting",
      topic: "Books of account",
      count: 4,
      syllabus: ["Sales day book", "Purchases day book", "Cash book", "Trial balance"]
    });

    expect(result).toHaveLength(4);
    expect(result.every((question) => !isPlaceholderQuestion(question))).toBe(true);
  });
});
