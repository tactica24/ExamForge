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
  const activeFocus = subtopics.slice(0, 2);
  const focusLine = activeFocus.length
    ? `Today we focus deeply on ${activeFocus.join(" and ")} within ${title}.`
    : `Today we focus deeply on the core building blocks of ${title}.`;

  const focusBreakdown = activeFocus.flatMap((subtopic, index) => [
    {
      heading: `${index + 1}) ${subtopic}: meaning and intuition`,
      explanation: `${subtopic} is a foundational part of ${title} in ${subject}. Start by defining it in plain language, then restate the rule as you would explain it to a classmate. For objective questions, exam setters often hide this idea in unfamiliar wording, so train yourself to map question language back to the core definition before touching options. Build intuition by asking what changes and what stays constant when you apply the rule in different examples.`
    },
    {
      heading: `${index + 1}) ${subtopic}: exam application steps`,
      explanation: `Use a repeatable step-by-step approach for ${subtopic}: identify the tested rule, translate values or terms correctly, run the operation, and verify units/conditions. Under time pressure, most mistakes come from skipping one of these steps, not from difficult arithmetic or vocabulary. Practice one timed mini-set where you say each step out loud, then review where your reasoning broke. This method turns ${subtopic} from memorization into a dependable exam process.`
    }
  ]);

  return {
    overview: `${title} is a high-impact area in ${subject}. ${focusLine} The goal is not to skim definitions, but to master how each idea behaves in real exam stems, including traps that look correct at first glance. Move from concept -> method -> timed practice -> error review. If you can explain the logic behind each step without looking at notes, your retention and speed both increase.`,
    breakdown: [
      {
        heading: "Topic map and why this matters",
        explanation: `Before solving questions, map the lesson into small parts: definition, rule, worked example, and common trap. This prevents overload and helps you connect each subtopic to the exact style of objective question where it appears. In exam prep, breadth without depth causes repeated errors, so focus on mastery of a narrow set per session. Your aim is to understand why an option is right or wrong, not just memorize final answers.`
      },
      ...focusBreakdown,
      {
        heading: "Integration and exam strategy",
        explanation: `After studying each focus subtopic, combine them in mixed questions and watch how setters blend concepts in one stem. Use elimination only after you test options against the governing rule. For difficult items, mark and return after quick wins, then solve with a strict checklist to avoid careless misses. End the session by summarizing one rule you mastered and one trap you will avoid next time.`
      }
    ],
    examples: [
      {
        question: `Example 1: In a ${subject} question on ${title}, two options look correct. What should you do first?`,
        walkthrough:
          "Identify the exact rule being tested, then test each remaining option against that rule step-by-step. Rewrite key values/terms from the stem, apply the rule carefully, and reject any option that breaks the rule even once.",
        answer: "Choose the option that stays fully consistent with the tested rule."
      },
      {
        question: `Example 2: You keep missing ${title} questions under time pressure. What should you change?`,
        walkthrough:
          "Create a short checklist for this topic and apply it to every question: identify rule, execute method, verify constraints, then select. Practice timed sets and review only the rule-based reason for each mistake.",
        answer: "Use a fixed checklist and timed review loop for this topic."
      },
      {
        question: `Example 3: A question combines two subtopics from ${title}. How do you avoid confusion?`,
        walkthrough:
          "Split the problem into parts and label which rule belongs to each subtopic. Solve the first part fully before moving to the second, then recombine results and verify that the final option satisfies both rules.",
        answer: "Decompose the question and apply one subtopic rule at a time."
      }
    ],
    common_mistakes: [
      "Picking the first option that sounds familiar without testing the rule.",
      "Confusing related concepts because definitions were memorized without examples.",
      "Combining multiple subtopics mentally without writing intermediate steps.",
      "Rushing difficult items instead of skipping and returning with fresh attention.",
      "Ignoring why wrong options are wrong, which causes repeated errors.",
      "Reviewing score only, without tracking the exact reasoning mistake."
    ],
    recap: [
      `Define ${title} clearly in one sentence before solving questions.`,
      "Match each question to a rule before reading options deeply.",
      "If multiple subtopics appear, solve one rule-layer at a time.",
      "Eliminate weak options early and compare the final two carefully.",
      "After each practice set, log one rule you got wrong and one fix.",
      "Reattempt missed questions 24 hours later without checking notes first."
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
    "You are an expert tutor creating deep study notes before a topic quiz.",
    "Return valid JSON only.",
    "Use this shape exactly:",
    '{"lesson":{"overview":"string","breakdown":[{"heading":"string","explanation":"string"}],"examples":[{"question":"string","walkthrough":"string","answer":"string"}],"common_mistakes":["string"],"recap":["string"],"visual_aids":[{"kind":"diagram|graph|illustration","title":"string","explanation":"string","alt_text":"string","prompt":"string","bullets":["string"],"points":[{"label":"string","value":42}]}]}}',
    "Teach for comprehension, not speed-writing. Explanations must be elaborate, practical, and exam-focused.",
    "Each breakdown explanation should be detailed enough to feel like a mini-lesson, not a short note.",
    subtopics.length
      ? `Primary focus subtopics for this session: ${subtopics.join(", ")}. Give dedicated breakdown coverage to each.`
      : "If subtopics are missing, infer likely subtopic blocks and teach them clearly.",
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
      "overview: 5-7 sentences with context, importance, and learning outcome",
      "breakdown: 5-8 sections with precise headings; each explanation should be 4-7 sentences",
      "examples: exactly 3 worked examples with clear step-by-step walkthroughs",
      "common_mistakes: 5-8 points",
      "recap: 6-8 action points",
      requiresRichVisuals
        ? "visual_aids: 2-3 entries, one must be graph with 3-6 points"
        : "visual_aids: 1-2 entries with concise bullets",
      "Avoid one-line explanations. Be explicit, instructional, and exam-useful.",
      "No markdown in JSON values"
    ]
  };

  const response = await generateJsonWithFallback<{ lesson: LessonDraft }>({
    system,
    user: `Create topic lesson JSON:\n${JSON.stringify(request)}`,
    temperature: 0.45,
    maxTokens: 2400,
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
