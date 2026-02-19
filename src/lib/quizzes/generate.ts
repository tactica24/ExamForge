import "server-only";

import { startOfDay } from "date-fns";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { generateQuestions } from "@/lib/quizzes/questions";
import { getTopicsForExamSubject } from "@/lib/syllabi/get";

function flattenTopics(topics: Array<{ title: string; path: string; subtopics?: string[] }>) {
  const out: string[] = [];
  for (const topic of topics) {
    if (topic.title) out.push(String(topic.title));
    if (topic.path && topic.path !== topic.title) out.push(String(topic.path));
    if (Array.isArray(topic.subtopics)) {
      for (const sub of topic.subtopics) out.push(`${topic.title}: ${sub}`);
    }
  }
  return Array.from(new Set(out)).slice(0, 30);
}

export async function getOrCreateDailyQuiz(args: {
  userId: string;
  examId: string;
  examName: string;
  examSlug?: string;
  subject: string;
  topicPath: string;
  difficulty?: "easy" | "medium" | "hard";
  preferredLanguage?: string | null;
}) {
  const firebase = await createFirebaseServerClient();
  const difficulty = args.difficulty ?? "medium";
  const dayStart = startOfDay(new Date()).toISOString();

  const { data: existing } = await firebase
    .from("quizzes")
    .select("id")
    .eq("exam_id", args.examId)
    .eq("subject", args.subject)
    .eq("topic_path", args.topicPath)
    .eq("quiz_type", "daily")
    .eq("created_by", args.userId)
    .gte("created_at", dayStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: quiz, error: quizErr } = await firebase
    .from("quizzes")
    .insert({
      exam_id: args.examId,
      subject: args.subject,
      topic_path: args.topicPath,
      quiz_type: "daily",
      difficulty,
      created_by: args.userId,
      meta: {
        preferred_language: args.preferredLanguage ?? "en"
      }
    })
    .select("id")
    .single();
  if (quizErr) throw quizErr;

  let examSlug = args.examSlug;
  if (!examSlug) {
    const { data: exam } = await firebase.from("exams").select("slug").eq("id", args.examId).maybeSingle();
    examSlug = exam?.slug ?? undefined;
  }

  let syllabus: string[] | undefined;
  if (examSlug) {
    const topics = await getTopicsForExamSubject({ examId: args.examId, examSlug, subject: args.subject });
    if (topics.length) syllabus = flattenTopics(topics);
  }

  const questions = await generateQuestions({
    examName: args.examName,
    subject: args.subject,
    topic: args.topicPath,
    count: 8,
    preferredLanguage: args.preferredLanguage ?? null,
    syllabus
  });

  const { error: qErr } = await firebase.from("quiz_questions").insert(
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
