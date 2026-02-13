import "server-only";

import { startOfDay } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOpenAIClient } from "@/lib/ai/openai";

type GeneratedQuestion = {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

function fallbackQuestions(topic: string, subject: string, count: number): GeneratedQuestion[] {
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

async function aiQuestions(args: {
  examName: string;
  subject: string;
  topic: string;
  count: number;
}): Promise<GeneratedQuestion[] | null> {
  const client = getOpenAIClient();
  if (!client) return null;

  const system =
    "You generate high-quality multiple-choice exam prep questions. Output must be valid JSON only.";
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
      .filter((q) => q.options.length === 4);
    return cleaned.length ? cleaned : null;
  } catch {
    return null;
  }
}

export async function getOrCreateDailyQuiz(args: {
  examId: string;
  examName: string;
  subject: string;
  topicPath: string;
  difficulty?: "easy" | "medium" | "hard";
}) {
  const supabase = createSupabaseServerClient();
  const difficulty = args.difficulty ?? "medium";
  const dayStart = startOfDay(new Date()).toISOString();

  const { data: existing } = await supabase
    .from("quizzes")
    .select("id")
    .eq("exam_id", args.examId)
    .eq("subject", args.subject)
    .eq("topic_path", args.topicPath)
    .eq("quiz_type", "daily")
    .gte("created_at", dayStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: quiz, error: quizErr } = await supabase
    .from("quizzes")
    .insert({
      exam_id: args.examId,
      subject: args.subject,
      topic_path: args.topicPath,
      quiz_type: "daily",
      difficulty
    })
    .select("id")
    .single();
  if (quizErr) throw quizErr;

  const ai = await aiQuestions({
    examName: args.examName,
    subject: args.subject,
    topic: args.topicPath,
    count: 8
  });
  const questions = ai ?? fallbackQuestions(args.topicPath, args.subject, 8);

  const { error: qErr } = await supabase.from("quiz_questions").insert(
    questions.map((q) => ({
      quiz_id: quiz.id,
      question: q.question,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation
    }))
  );
  if (qErr) throw qErr;

  return quiz.id;
}

