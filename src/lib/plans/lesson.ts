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
      explanation: `Shows the main parts and relationships in ${args.title} so the learner can see how the ideas connect.`,
      alt_text: `Labeled diagram for ${args.title} in ${args.subject}.`,
      prompt: `Create a clean labeled educational diagram for ${args.subject} topic ${args.title}. Highlight key parts and one common point of confusion.`,
      bullets: [
        "Label key parts clearly and keep wording short.",
        "Show how one concept links to the next.",
        "Include one frequent confusion and the correct interpretation."
      ],
      points: []
    });
  }

  if (policy.allowGraph) {
    visualAids.push({
      kind: "graph",
      title: `${args.title} trend chart`,
      explanation: `Summarizes numeric relationships in ${args.title} so patterns can be compared quickly.`,
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
      explanation: `${subtopic} is a foundational part of ${title} in ${subject}. Start by defining it in plain language, then restate the idea as you would explain it to a classmate. After that, connect the definition to a simple example so you can see what changes and what stays constant when the idea is applied. The aim is to understand the concept well enough to recognize it even when the wording changes.`
    },
    {
      heading: `${index + 1}) ${subtopic}: using the idea correctly`,
      explanation: `Apply ${subtopic} in a steady sequence: identify the rule or meaning involved, connect it to the given condition, carry out the needed step, and check that the final statement still fits the concept. Most errors happen when one condition is ignored or when a related term is treated as if it means the same thing. A short worked example is often enough to turn the idea from memorized words into usable understanding.`
    }
  ]);

  return {
    overview: `${title} is an important part of ${subject}. ${focusLine} Start with the core meaning of each idea, then connect it to examples and short applications so the topic becomes concrete. A strong lesson on ${title} should help the learner define the idea clearly, recognise it in different wording, and apply it carefully to related problems. By the end of the session, the learner should be able to explain the rule, show where it applies, and avoid the most common misunderstandings.`,
    breakdown: [
      {
        heading: "Topic map and why this matters",
        explanation: `Break ${title} into small parts: the main definition, the core rule or principle, a worked example, and the common misunderstanding attached to it. This makes the lesson easier to follow and shows how each subtopic supports the next. Depth matters more than speed here, because clear understanding is what makes later practice useful.`
      },
      ...focusBreakdown,
      {
        heading: "Putting the parts together",
        explanation: `After learning the main pieces, combine them in short mixed examples so the learner can see how the ideas support one another. The goal is to move from isolated facts to connected understanding. End the lesson by summarizing the rule you now understand better and one misunderstanding that has been cleared up.`
      }
    ],
    examples: [
      {
        question: `Example 1: Which statement best defines ${activeFocus[0] ?? title}?`,
        walkthrough:
          `Start from the exact meaning of ${activeFocus[0] ?? title}. Remove any statement that changes the core idea, removes an important condition, or mixes it up with a related term. The remaining statement should preserve both the meaning and the scope of the concept.`,
        answer: `The correct choice is the statement that preserves the meaning of ${activeFocus[0] ?? title} accurately.`
      },
      {
        question: `Example 2: Which condition must be checked before ${activeFocus[1] ?? title} is applied?`,
        walkthrough:
          `Identify the condition that makes ${activeFocus[1] ?? title} valid. Then compare each option or scenario with that condition. Any option that ignores the required condition, changes the setting, or applies the idea too broadly should be ruled out.`,
        answer: `The correct answer is the one that keeps the required condition for ${activeFocus[1] ?? title} in place.`
      },
      {
        question: `Example 3: How can ${title} be handled when two related ideas appear together?`,
        walkthrough:
          `Separate the problem into the two ideas involved, decide what each part contributes, and solve in a clear order. Once both parts are understood, combine them carefully and check that the final result still matches the rule for the topic.`,
        answer: `Handle the parts one at a time, then combine them only after each idea is clear.`
      }
    ],
    common_mistakes: [
      "Confusing a topic with another idea that sounds similar but has a different meaning.",
      "Memorizing the definition without connecting it to an example or application.",
      "Ignoring the condition that must hold before the rule can be applied.",
      "Combining multiple subtopics mentally without separating their roles clearly.",
      "Focusing on the final answer without checking whether the reasoning is sound.",
      "Repeating the same misunderstanding because earlier mistakes were not reviewed carefully."
    ],
    recap: [
      `Define ${title} clearly in one sentence before solving questions.`,
      "Connect each definition to one example or worked application.",
      "Check the condition that makes the rule valid before applying it.",
      "If multiple ideas appear together, separate them and solve in a clear order.",
      "Review why a wrong option is wrong, not just why the right one is right.",
      "Revisit the topic later and explain it again without looking at notes."
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
    "You are an expert subject tutor creating deep study notes before a topic quiz.",
    "Write like a knowledgeable teacher, not like an AI assistant or exam coach.",
    "Return valid JSON only.",
    "Use this shape exactly:",
    '{"lesson":{"overview":"string","breakdown":[{"heading":"string","explanation":"string"}],"examples":[{"question":"string","walkthrough":"string","answer":"string"}],"common_mistakes":["string"],"recap":["string"],"visual_aids":[{"kind":"diagram|graph|illustration","title":"string","explanation":"string","alt_text":"string","prompt":"string","bullets":["string"],"points":[{"label":"string","value":42}]}]}}',
    "Teach for comprehension, not speed-writing. Explanations must be elaborate, practical, and exam-focused.",
    "Each breakdown explanation should be detailed enough to feel like a mini-lesson, not a short note.",
    "Do not mention exam setters, tricks, traps, guessing, or test-taking strategy.",
    "Worked examples must be real topic questions or concept checks, not advice about how to answer questions.",
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
      "Examples must be content-based, not meta-study prompts.",
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
