import "server-only";

import { getOpenAIClient } from "@/lib/ai/openai";
import { languageInstruction } from "@/lib/ai/language";

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
      explanation:
        "This is a fallback question. Add OPENAI_API_KEY to generate exam-style questions with detailed explanations."
    });
  }
  return qs;
}

export async function generateQuestions(args: {
  examName: string;
  subject: string;
  topic: string;
  count: number;
  preferredLanguage?: string | null;
}): Promise<GeneratedQuestion[]> {
  const client = getOpenAIClient();
  if (!client) return fallbackQuestions(args.topic, args.subject, args.count);

  const lang = languageInstruction(args.preferredLanguage);
  const system = [
    "You generate high-quality multiple-choice exam prep questions.",
    "Output must be valid JSON only.",
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
      "Include brief explanations."
    ]
  };

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.6,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Generate questions as JSON:\n${JSON.stringify(user)}` }
    ],
    response_format: { type: "json_object" }
  });

  const text = completion.choices[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(text);
    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const cleaned: GeneratedQuestion[] = questions
      .filter((q: any) => typeof q?.question === "string" && Array.isArray(q?.options))
      .map((q: any) => ({
        question: String(q.question).slice(0, 500),
        options: (q.options as any[]).slice(0, 4).map((o) => String(o).slice(0, 140)),
        correct_index: Math.max(0, Math.min(3, Number(q.correct_index ?? 0))),
        explanation: String(q.explanation ?? "").slice(0, 700)
      }))
      .filter((q: GeneratedQuestion) => q.options.length === 4);
    return cleaned.length ? cleaned : fallbackQuestions(args.topic, args.subject, args.count);
  } catch {
    return fallbackQuestions(args.topic, args.subject, args.count);
  }
}
