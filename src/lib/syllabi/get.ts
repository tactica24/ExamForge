import "server-only";

import { createFirebaseServerClient } from "@/lib/firebase/server";
import { getOpenAIClient } from "@/lib/ai/openai";
import { getFallbackTopics, getGenericTopicsForSubject, type Topic } from "@/lib/syllabi/fallback";

async function generateAiTopics(args: { examSlug: string; subject: string }) {
  const client = getOpenAIClient();
  if (!client) return null;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You generate exam syllabus topic trees.",
          "Return valid JSON only in this format: {\"topics\":[{\"title\":\"...\",\"path\":\"...\",\"subtopics\":[\"...\",\"...\"]}]}",
          "Keep it concise, practical, and suitable for objective-question preparation.",
          "Create 8 to 12 topics with short subtopics."
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          exam: args.examSlug.toUpperCase(),
          subject: args.subject
        })
      }
    ]
  });

  const text = completion.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(text);
  const raw = Array.isArray(parsed?.topics) ? parsed.topics : [];

  const topics: Topic[] = raw
    .filter((item: any) => typeof item?.title === "string")
    .map((item: any) => ({
      title: String(item.title).slice(0, 120),
      path: String(item.path ?? item.title).slice(0, 120),
      subtopics: Array.isArray(item.subtopics) ? item.subtopics.map((sub: any) => String(sub).slice(0, 120)).slice(0, 8) : []
    }))
    .filter((item: Topic) => item.title.length >= 2);

  return topics.length ? topics : null;
}

export async function getTopicsForExamSubject(args: { examId: string; examSlug: string; subject: string }) {
  const firebase = await createFirebaseServerClient();

  const { data } = await firebase
    .from("syllabi")
    .select("topics")
    .eq("exam_id", args.examId)
    .eq("subject", args.subject)
    .maybeSingle();

  if (data?.topics && Array.isArray(data.topics)) {
    return data.topics as unknown as Array<{ title: string; path: string; subtopics?: string[]; resources?: any[] }>;
  }

  const fallback = getFallbackTopics(args.examSlug, args.subject);
  if (fallback) return fallback;

  try {
    const aiTopics = await generateAiTopics({ examSlug: args.examSlug, subject: args.subject });
    if (aiTopics?.length) {
      await firebase
        .from("syllabi")
        .upsert(
          {
            exam_id: args.examId,
            subject: args.subject,
            topics: aiTopics as any
          },
          { onConflict: "exam_id,subject" }
        )
        .then(() => {})
        .catch(() => {});
      return aiTopics;
    }
  } catch {
    // Ignore AI failures and continue to deterministic fallback topics.
  }

  return getGenericTopicsForSubject(args.subject);
}
