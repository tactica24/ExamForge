import "server-only";

import { languageInstruction } from "@/lib/ai/language";
import { generateJsonWithFallback } from "@/lib/ai/multi";

export type GeneratedQuestion = {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

export function fallbackQuestions(topic: string, subject: string, count: number): GeneratedQuestion[] {
  const qs: GeneratedQuestion[] = [];
  for (let i = 1; i <= count; i++) {
    const correct = i % 4;
    qs.push({
      question: `(${subject}) ${topic}: Practice question ${i}. Which option best fits?`,
      options: [
        "Option A (concept check)",
        "Option B (common trap)",
        "Option C (partial truth)",
        "Option D (best answer)"
      ],
      correct_index: correct,
      explanation: "Review the core rule for this topic and compare each option against that rule before choosing."
    });
  }
  return qs;
}

function normalizeQuestions(raw: any): GeneratedQuestion[] {
  const questions = Array.isArray(raw?.questions) ? raw.questions : [];
  return questions
    .filter((q: any) => typeof q?.question === "string" && Array.isArray(q?.options))
    .map((q: any) => ({
      question: String(q.question).slice(0, 500),
      options: (q.options as any[]).slice(0, 4).map((o) => String(o).slice(0, 140)),
      correct_index: Math.max(0, Math.min(3, Number(q.correct_index ?? 0))),
      explanation: String(q.explanation ?? "").slice(0, 700)
    }))
    .filter((q: GeneratedQuestion) => q.options.length === 4);
}

export async function generateQuestions(args: {
  examName: string;
  subject: string;
  topic: string;
  count: number;
  preferredLanguage?: string | null;
  syllabus?: string[];
  strictSyllabus?: boolean;
}): Promise<GeneratedQuestion[]> {
  const lang = languageInstruction(args.preferredLanguage);
  const syllabusHint =
    args.syllabus && args.syllabus.length
      ? args.strictSyllabus
        ? `Use only these topics/subtopics. Do not use any other topic:\n- ${args.syllabus.join("\n- ")}`
        : `Use only these syllabus topics/subtopics when possible:\n- ${args.syllabus.join("\n- ")}`
      : "If no syllabus is provided, answer generally for the exam level.";

  const system = [
    "You generate high-quality objective exam prep questions.",
    "Output must be valid JSON only.",
    syllabusHint,
    lang
  ]
    .filter(Boolean)
    .join("\n");

  const user = {
    exam: args.examName,
    subject: args.subject,
    topic: args.topic,
    count: args.count,
    format: {
      questions: [
        {
          question: "string",
          options: ["string", "string", "string", "string"],
          correct_index: 0,
          explanation: "string"
        }
      ]
    },
    constraints: [
      "Options must be plausible and unique.",
      "correct_index must be 0..3.",
      "Use clear Nigerian/International English (no slang).",
      "Include brief explanations.",
      "Cover a spread of conceptual, application, and exam-style trap questions."
    ]
  };

  const response = await generateJsonWithFallback<any>({
    system,
    user: `Generate questions as JSON:\n${JSON.stringify(user)}`,
    temperature: 0.55,
    validate: (parsed) => {
      const cleaned = normalizeQuestions(parsed);
      if (!cleaned.length) return null;
      return { questions: cleaned };
    }
  });

  const cleaned = response.value?.questions ?? [];
  if (cleaned.length) return cleaned.slice(0, args.count);
  return fallbackQuestions(args.topic, args.subject, args.count);
}
