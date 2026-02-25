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

type VisualPolicy = {
  allowGraph: boolean;
  preferDiagram: boolean;
  requiresVisualAid: boolean;
  maxVisualAids: number;
};

function getVisualPolicy(subject: string, topic: string): VisualPolicy {
  const subjectKey = normalizeText(subject, 120).toLowerCase();
  const key = `${subject} ${topic}`.toLowerCase();

  const graphSubject =
    /(math|mathematics|further|physics|chemistry|economics|statistics|quantitative|gmat|accounting|finance|geography)/i.test(
      subjectKey
    );
  const graphTopic = /(graph|chart|table|trend|data|rate|ratio|probability|distribution|coordinate|demand|supply|motion)/i.test(
    key
  );

  const diagramSubject =
    /(biology|agric|agriculture|animal husbandry|crop production|chemistry|physics|geography|basic science|health science|anatomy|technical drawing|home economics|food and nutrition)/i.test(
      subjectKey
    );
  const diagramTopic =
    /(diagram|label|structure|heart|cell|organ|tissue|circuit|apparatus|map|soil profile|seed|seedling|life cycle|anatomy|digestive|respiratory|skeletal|reproductive|plant|flower)/i.test(
      key
    );

  const languageHeavy = /(english|language|literature|government|history|civic|crk|irs|commerce|marketing|book-keeping|bookkeeping)/i.test(
    subjectKey
  );
  const textOnlyTopic = /(noun|pronoun|verb|adjective|adverb|concord|tense|direct and indirect speech|speech|comprehension|summary|lexis|structure)/i.test(
    key
  );

  const blockVisuals = languageHeavy && textOnlyTopic && !diagramTopic && !graphTopic;
  const allowGraph = (graphSubject || graphTopic) && !blockVisuals;
  const preferDiagram = (diagramSubject || diagramTopic) && !blockVisuals;
  const requiresVisualAid = (allowGraph || preferDiagram) && !blockVisuals;

  return {
    allowGraph,
    preferDiagram,
    requiresVisualAid,
    maxVisualAids: blockVisuals ? 0 : allowGraph ? 2 : preferDiagram ? 2 : 1
  };
}

function visualSystemInstruction(policy: VisualPolicy) {
  if (!policy.requiresVisualAid) {
    return "Visual policy: for text-heavy topics (for example English grammar, nouns, or direct/indirect speech), set visual_aids to an empty array. Do not include charts/graphs.";
  }

  if (policy.allowGraph && policy.preferDiagram) {
    return "Visual policy: include 1-2 visual_aids. Use at most one graph only for numeric/trend relationships, and include at least one labeled diagram or illustration.";
  }

  if (policy.allowGraph) {
    return "Visual policy: include 1-2 visual_aids. Use a graph only when numeric relationships are central; otherwise use diagram/illustration.";
  }

  return "Visual policy: include 1-2 visual_aids as diagram/illustration with clear labels. Do not include graph.";
}

function visualConstraint(policy: VisualPolicy) {
  if (!policy.requiresVisualAid) return "visual_aids: []";
  if (policy.allowGraph && policy.preferDiagram) {
    return "visual_aids: 1-2 entries, max one graph (3-6 points) plus at least one labeled diagram/illustration";
  }
  if (policy.allowGraph) return "visual_aids: 1-2 entries; graph optional (3-6 points) only when needed";
  return "visual_aids: 1-2 entries, diagram/illustration only (points should be empty)";
}

function fallbackVisualAids(args: {
  subject: string;
  title: string;
  subtopics: string[];
}): PlanVisualAid[] {
  const policy = getVisualPolicy(args.subject, args.title);
  if (!policy.requiresVisualAid) return [];

  const visualAids: PlanVisualAid[] = [];

  if (policy.preferDiagram) {
    visualAids.push({
      kind: "diagram",
      title: `${args.title} labeled concept map`,
      explanation: `Shows the major parts and relationships in ${args.title} so learners can interpret exam wording quickly.`,
      alt_text: `Labeled diagram for ${args.title} in ${args.subject}.`,
      prompt: `Create a clean labeled educational diagram for ${args.subject} topic ${args.title}. Highlight key parts and one common confusion point.`,
      bullets: [
        "Label key parts clearly and keep wording short.",
        "Show how one concept links to the next.",
        "Include one frequent exam confusion and correction."
      ],
      points: []
    });
  }

  if (policy.allowGraph) {
    visualAids.push({
      kind: "graph",
      title: `${args.title} trend chart`,
      explanation: `Summarizes numeric relationships in ${args.title} to support faster interpretation of exam questions.`,
      alt_text: `Chart showing ${args.title} values or trend patterns.`,
      prompt: `Generate a simple chart for ${args.subject} topic ${args.title} showing meaningful labels and numeric values.`,
      bullets: [
        "Use values only when the topic naturally involves quantity or trend.",
        "Keep axis labels and units explicit."
      ],
      points: [
        { label: args.subtopics[0] ?? "Core concept", value: 42 },
        { label: args.subtopics[1] ?? "Application", value: 58 },
        { label: args.subtopics[2] ?? "Interpretation", value: 66 }
      ]
    });
  }

  if (!visualAids.length) {
    visualAids.push({
      kind: "illustration",
      title: `${args.title} concept illustration`,
      explanation: `Provides a simple mental model for ${args.title} using one clear scenario.`,
      alt_text: `Illustration for ${args.title} in ${args.subject}.`,
      prompt: `Create a minimal educational illustration that explains ${args.title} for ${args.subject} candidates.`,
      bullets: [
        "Highlight one likely misconception.",
        "Show the correct interpretation in one clear scene."
      ],
      points: []
    });
  }

  return visualAids.slice(0, policy.maxVisualAids);
}

function alignVisualAidsToPolicy(args: {
  subject: string;
  title: string;
  subtopics: string[];
  visualAids: PlanVisualAid[];
}): PlanVisualAid[] {
  const policy = getVisualPolicy(args.subject, args.title);
  if (!policy.requiresVisualAid) return [];

  let visualAids = (args.visualAids ?? []).map((visual) => {
    if (visual.kind === "graph" && !policy.allowGraph) {
      return {
        ...visual,
        kind: "illustration",
        points: []
      } as PlanVisualAid;
    }
    return visual;
  });

  if (!policy.allowGraph) {
    visualAids = visualAids.filter((visual) => visual.kind !== "graph");
  }

  if (policy.allowGraph) {
    const hasGraph = visualAids.some((visual) => visual.kind === "graph" && visual.points.length >= 2);
    if (!hasGraph) {
      const fallbackGraph = fallbackVisualAids(args).find((visual) => visual.kind === "graph");
      if (fallbackGraph) visualAids.push(fallbackGraph);
    }
  }

  if (policy.preferDiagram) {
    const hasDiagramLike = visualAids.some((visual) => visual.kind === "diagram" || visual.kind === "illustration");
    if (!hasDiagramLike) {
      const fallbackDiagram = fallbackVisualAids(args).find((visual) => visual.kind !== "graph");
      if (fallbackDiagram) visualAids.unshift(fallbackDiagram);
    }
  }

  if (!visualAids.length) return fallbackVisualAids(args);
  return visualAids.slice(0, policy.maxVisualAids);
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
  const visualPolicy = getVisualPolicy(args.subject, title);
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
    visualSystemInstruction(visualPolicy),
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
      visualConstraint(visualPolicy),
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

  const visualAids = alignVisualAidsToPolicy({
    subject: args.subject,
    title,
    subtopics,
    visualAids: draft.visual_aids
  });

  return {
    ...draft,
    visual_aids: visualAids,
    generated_at: new Date().toISOString(),
    source: "ai",
    provider: response.provider,
    model: response.model
  };
}
