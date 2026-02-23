import "server-only";

import { languageInstruction } from "@/lib/ai/language";
import { generateJsonWithFallback } from "@/lib/ai/multi";
import { normalizePlanLesson, type PlanLesson, type PlanVisualAid } from "@/lib/plans/content";

type LessonDraft = {
  overview: string;
  breakdown: Array<{ heading: string; explanation: string }>;
  examples: Array<{ question: string; walkthrough: string; answer: string }>;
  common_mistakes: string[];
  recap: string[];
  visual_aids: PlanVisualAid[];
};

function normalizeText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeLessonDraft(value: unknown): LessonDraft | null {
  const normalized = normalizePlanLesson({
    ...(typeof value === "object" && value ? (value as Record<string, unknown>) : {}),
    generated_at: new Date().toISOString(),
    source: "ai",
    provider: null,
    model: null
  });

  if (!normalized) return null;

  return {
    overview: normalized.overview,
    breakdown: normalized.breakdown,
    examples: normalized.examples,
    common_mistakes: normalized.common_mistakes,
    recap: normalized.recap,
    visual_aids: normalized.visual_aids
  };
}

function subjectNeedsCharts(subject: string, topic: string) {
  const key = `${subject} ${topic}`.toLowerCase();
  return /(math|mathematics|further|physics|chemistry|economics|statistics|quantitative|gmat|accounting|finance)/i.test(
    key
  );
}

function fallbackVisualAids(args: {
  subject: string;
  title: string;
  subtopics: string[];
}): PlanVisualAid[] {
  const visualAids: PlanVisualAid[] = [
    {
      kind: "diagram",
      title: `${args.title} concept flow`,
      explanation: `Shows how core ideas in ${args.title} move from definition to exam application.`,
      alt_text: `Concept flow diagram for ${args.title} in ${args.subject}.`,
      prompt: `Create a clean educational diagram for ${args.subject} topic ${args.title} showing concept -> rule -> application -> common trap.`,
      bullets: [
        "Start with the core concept definition.",
        "Connect each rule to one exam-style application.",
        "Show one common trap and where it appears."
      ],
      points: []
    }
  ];

  if (subjectNeedsCharts(args.subject, args.title)) {
    visualAids.push({
      kind: "graph",
      title: `${args.title} mastery tracker`,
      explanation: `Visualizes the difficulty spread so learners can focus revision on high-impact areas in ${args.title}.`,
      alt_text: `Bar chart showing topic mastery scores for ${args.title}.`,
      prompt: `Generate a simple bar chart for ${args.subject} ${args.title} with labels and values representing mastery levels.`,
      bullets: [
        "Lower values indicate weaker subareas that need revision first.",
        "Track improvement after each timed objective-question set."
      ],
      points: [
        { label: args.subtopics[0] ?? "Core concept", value: 42 },
        { label: args.subtopics[1] ?? "Application", value: 58 },
        { label: args.subtopics[2] ?? "Exam strategy", value: 66 }
      ]
    });
  } else {
    visualAids.push({
      kind: "illustration",
      title: `${args.title} exam context illustration`,
      explanation: `Provides a quick mental picture to connect ${args.title} with real exam question wording.`,
      alt_text: `Illustration brief for ${args.title} exam context.`,
      prompt: `Create a minimal classroom-style illustration that explains ${args.title} for ${args.subject} candidates.`,
      bullets: [
        "Highlight where candidates usually misread the question.",
        "Show the correct interpretation in one clear scene."
      ],
      points: []
    });
  }

  return visualAids;
}

function fallbackLesson(args: {
  subject: string;
  topicPath: string;
  topicTitle?: string;
  subtopics?: string[];
}): PlanLesson {
  const title = normalizeText(args.topicTitle || args.topicPath, 120) || "Topic";
  const subject = normalizeText(args.subject, 120) || "Subject";
  const subtopics = Array.isArray(args.subtopics)
    ? args.subtopics.map((item) => normalizeText(item, 100)).filter(Boolean).slice(0, 8)
    : [];
  const focusLine = args.subtopics?.length
    ? `Focus areas: ${args.subtopics.slice(0, 4).join(", ")}.`
    : `Focus on definitions, application patterns, and exam traps in ${title}.`;

  return {
    overview: `${title} is a key part of ${subject}. ${focusLine} Build speed by identifying the rule each question is testing before selecting an option.`,
    breakdown: [
      {
        heading: "1) What this topic means",
        explanation: `${title} covers the core language and structure rules exam setters repeatedly test. Your first goal is to recognize the concept being tested in each question stem.`
      },
      {
        heading: "2) Core rules to master",
        explanation: `List the high-frequency rules, then attach one simple example to each rule. During revision, explain each rule in your own words and check that your explanation still gives the correct answer.`
      },
      {
        heading: "3) How it appears in objective questions",
        explanation: `Questions often hide the tested rule with distractors that are close to correct. Compare every option against the same rule, not against your first impression.`
      },
      {
        heading: "4) Exam strategy for speed and accuracy",
        explanation: `Use a two-pass method: answer direct questions first, then return to tricky items. Eliminate clearly wrong choices early so you can focus on the strongest two options.`
      }
    ],
    examples: [
      {
        question: `Example: In a ${subject} objective item on ${title}, two options look correct. How do you decide quickly?`,
        walkthrough:
          "Identify the exact rule being tested, then test each remaining option against that rule step-by-step. Reject any option that breaks the rule even once.",
        answer: "Choose the option that stays fully consistent with the tested rule."
      },
      {
        question: `Example: You keep missing ${title} questions under time pressure. What should you change?`,
        walkthrough:
          "Create a short checklist for this topic and apply it to every question. Practice timed sets and review only the rule-based reason for each mistake.",
        answer: "Use a fixed checklist and timed review loop for this topic."
      }
    ],
    common_mistakes: [
      "Picking the first option that sounds familiar without testing the rule.",
      "Confusing related concepts because definitions were memorized without examples.",
      "Rushing difficult items instead of skipping and returning with fresh attention.",
      "Ignoring why wrong options are wrong, which causes repeated errors."
    ],
    recap: [
      `Define ${title} clearly in one sentence before solving questions.`,
      "Match each question to a rule before reading options deeply.",
      "Eliminate weak options early and compare the final two carefully.",
      "After each practice set, log one rule you got wrong and one fix."
    ],
    visual_aids: fallbackVisualAids({ subject, title, subtopics }),
    generated_at: new Date().toISOString(),
    source: "fallback",
    provider: null,
    model: null
  };
}

export async function generatePlanLesson(args: {
  examName: string;
  subject: string;
  topicPath: string;
  topicTitle?: string;
  subtopics?: string[];
  preferredLanguage?: string | null;
}): Promise<PlanLesson> {
  const title = normalizeText(args.topicTitle || args.topicPath, 120) || args.topicPath;
  const subtopics = Array.isArray(args.subtopics)
    ? args.subtopics.map((item) => normalizeText(item, 100)).filter(Boolean).slice(0, 8)
    : [];

  const language = languageInstruction(args.preferredLanguage);
  const requiresRichVisuals = subjectNeedsCharts(args.subject, title);
  const system = [
    "You are an exam tutor creating deep study notes before a topic quiz.",
    "Return valid JSON only.",
    "Use this shape exactly:",
    '{"lesson":{"overview":"string","breakdown":[{"heading":"string","explanation":"string"}],"examples":[{"question":"string","walkthrough":"string","answer":"string"}],"common_mistakes":["string"],"recap":["string"],"visual_aids":[{"kind":"diagram|graph|illustration","title":"string","explanation":"string","alt_text":"string","prompt":"string","bullets":["string"],"points":[{"label":"string","value":42}]}]}}',
    "Keep explanations practical and exam-focused.",
    "Use clear, direct language with concrete examples.",
    requiresRichVisuals
      ? "This topic is visual-heavy. Include at least 2 visual_aids with at least 1 graph."
      : "Include at least 1 useful visual_aid. Use graph only when it improves understanding.",
    language
  ]
    .filter(Boolean)
    .join("\n");

  const request = {
    exam: args.examName,
    subject: args.subject,
    topic: title,
    topic_path: args.topicPath,
    subtopics,
    constraints: [
      "overview: 3-5 sentences",
      "breakdown: 4-6 sections with precise headings",
      "examples: exactly 2 worked examples",
      "common_mistakes: 4-6 points",
      "recap: 4-6 action points",
      requiresRichVisuals
        ? "visual_aids: 2-3 entries, one must be graph with 3-6 points"
        : "visual_aids: 1-2 entries with concise bullets",
      "No markdown in JSON values"
    ]
  };

  const response = await generateJsonWithFallback<{ lesson: LessonDraft }>({
    system,
    user: `Create topic lesson JSON:\n${JSON.stringify(request)}`,
    temperature: 0.45,
    maxTokens: 1500,
    validate: (parsed) => {
      const lesson = normalizeLessonDraft(parsed?.lesson ?? parsed);
      if (!lesson) return null;
      return { lesson };
    }
  });

  const draft = response.value?.lesson ?? null;
  if (!draft) {
    return fallbackLesson({
      subject: args.subject,
      topicPath: args.topicPath,
      topicTitle: title,
      subtopics
    });
  }

  return {
    ...draft,
    generated_at: new Date().toISOString(),
    source: "ai",
    provider: response.provider,
    model: response.model
  };
}
