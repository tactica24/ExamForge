import "server-only";

import { languageInstruction } from "@/lib/ai/language";
import { generateJsonWithFallback } from "@/lib/ai/multi";

export type GeneratedQuestion = {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

function normalizeText(value: string, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function baseTopicLabel(topic: string) {
  const cleaned = normalizeText(topic, 140);
  if (!cleaned) return "this topic";
  const parts = cleaned.split(":").map((part) => part.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? cleaned;
}

function topicFocuses(topic: string, syllabus: string[] | undefined, count: number) {
  const seed = [baseTopicLabel(topic), ...(syllabus ?? [])]
    .map((entry) => normalizeText(entry, 140))
    .filter(Boolean)
    .filter((entry, index, all) => all.indexOf(entry) === index);

  if (!seed.length) return Array.from({ length: count }, () => "Core concept");

  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(seed[i % seed.length]);
  }
  return out;
}

function clampCorrectIndex(value: number) {
  return Math.max(0, Math.min(3, Number.isFinite(value) ? value : 0));
}

function isQuantSubject(subject: string) {
  return /(math|mathematics|quant|physics|chemistry|economics|statistics|accounting|finance|gmat|data|reasoning)/i.test(
    subject
  );
}

function makeQuantFallback(args: { examName: string; subject: string; topic: string; focus: string; index: number }): GeneratedQuestion {
  const base = 12 + args.index * 3;
  const delta = 3 + (args.index % 4);
  const next = base + delta;
  const percent = Math.round((delta / base) * 100);
  const distractors = [Math.max(1, percent - 6), percent + 5, percent + 12];
  const options = [`${percent}%`, `${distractors[0]}%`, `${distractors[1]}%`, `${distractors[2]}%`];
  const correctIndex = args.index % 4;
  const rotated = options.slice(correctIndex).concat(options.slice(0, correctIndex));

  return {
    question: `(${args.examName} ${args.subject}) ${args.focus}: A value changes from ${base} to ${next}. Which option gives the best percentage increase?`,
    options: rotated,
    correct_index: (4 - correctIndex) % 4,
    explanation: `Percentage increase = ((${next} - ${base}) / ${base}) x 100 = ${percent}%. Apply this process to ${args.topic} questions before checking options.`
  };
}

function makeConceptFallback(args: { examName: string; subject: string; topic: string; focus: string }): GeneratedQuestion {
  return {
    question: `(${args.examName} ${args.subject}) Which option best explains ${args.focus} in ${args.topic}?`,
    options: [
      `Focus on the core definition of ${args.focus} and how it appears in exam prompts.`,
      `Ignore the prompt context and choose whichever option looks longest.`,
      `Rely on memorized wording only, even when the question changes the scenario.`,
      `Skip checking units, constraints, or keywords before selecting an option.`
    ],
    correct_index: 0,
    explanation: `Correct answers in ${args.subject} usually come from the exact concept tested in the prompt. Start with the core definition of ${args.focus}, then test each option against it.`
  };
}

function makeApplicationFallback(args: { examName: string; subject: string; topic: string; focus: string }): GeneratedQuestion {
  return {
    question: `(${args.examName} ${args.subject}) In an objective item on ${args.focus}, what should you do first to avoid common traps?`,
    options: [
      "Match each option against the rule tested in the stem before elimination.",
      "Pick the first option that mentions a familiar keyword.",
      "Eliminate options randomly to save time.",
      "Choose options based on wording complexity instead of concept fit."
    ],
    correct_index: 0,
    explanation: `In ${args.topic} questions, the safest first step is to identify the exact rule/skill being tested and use it to evaluate every option.`
  };
}

function makeTrapFallback(args: { examName: string; subject: string; topic: string; focus: string }): GeneratedQuestion {
  return {
    question: `(${args.examName} ${args.subject}) Which choice is the most reliable strategy when two options on ${args.focus} look correct?`,
    options: [
      "Re-read the stem for qualifiers (always, most, except) and check edge conditions.",
      "Pick the option with more technical terms.",
      "Select the answer that appears most often in past attempts.",
      "Skip the item without verifying assumptions."
    ],
    correct_index: 0,
    explanation: `Most close-option traps in ${args.topic} are resolved by checking qualifiers and constraints in the stem.`
  };
}

function rotateQuestion(args: { base: GeneratedQuestion; step: number }): GeneratedQuestion {
  const shift = ((args.step % 4) + 4) % 4;
  if (shift === 0) return args.base;

  const options = args.base.options.slice(shift).concat(args.base.options.slice(0, shift));
  const correct = (args.base.correct_index - shift + 4) % 4;
  return {
    ...args.base,
    options,
    correct_index: correct
  };
}

export function isPlaceholderQuestion(value: Pick<GeneratedQuestion, "question" | "options">) {
  const q = normalizeText(value.question, 500).toLowerCase();
  const options = (value.options ?? []).map((option) => normalizeText(option, 140).toLowerCase());
  if (!q) return true;
  if (/practice question\s*\d+/i.test(q)) return true;
  if (/which option best fits/i.test(q)) return true;
  if (options.length === 4 && options.every((option) => /^option [abcd](\b|\s|\()/.test(option))) return true;
  return false;
}

export function fallbackQuestions(args: {
  examName: string;
  topic: string;
  subject: string;
  count: number;
  syllabus?: string[];
}): GeneratedQuestion[] {
  const amount = Math.max(1, Math.min(100, Math.trunc(args.count || 1)));
  const focuses = topicFocuses(args.topic, args.syllabus, amount);
  const isQuant = isQuantSubject(args.subject);

  const questions: GeneratedQuestion[] = [];
  for (let i = 0; i < amount; i += 1) {
    const focus = focuses[i] ?? baseTopicLabel(args.topic);
    const variant = i % 3;
    const base =
      isQuant && i % 2 === 0
        ? makeQuantFallback({
            examName: args.examName,
            subject: args.subject,
            topic: args.topic,
            focus,
            index: i
          })
        : variant === 0
          ? makeConceptFallback({
              examName: args.examName,
              subject: args.subject,
              topic: args.topic,
              focus
            })
          : variant === 1
            ? makeApplicationFallback({
                examName: args.examName,
                subject: args.subject,
                topic: args.topic,
                focus
              })
            : makeTrapFallback({
                examName: args.examName,
                subject: args.subject,
                topic: args.topic,
                focus
              });

    questions.push(rotateQuestion({ base, step: i }));
  }

  return questions;
}

function normalizeQuestions(raw: any): GeneratedQuestion[] {
  const questions = Array.isArray(raw?.questions) ? raw.questions : [];
  const seen = new Set<string>();

  return questions
    .filter((q: any) => typeof q?.question === "string" && Array.isArray(q?.options))
    .map((q: any): GeneratedQuestion => ({
      question: normalizeText(q.question, 500),
      options: (q.options as any[]).slice(0, 4).map((o) => normalizeText(o, 140)),
      correct_index: clampCorrectIndex(Number(q.correct_index ?? 0)),
      explanation: normalizeText(String(q.explanation ?? ""), 700)
    }))
    .filter((q: GeneratedQuestion) => q.options.length === 4 && !q.options.some((option) => !option))
    .filter((q: GeneratedQuestion) => !isPlaceholderQuestion(q))
    .filter((q: GeneratedQuestion) => {
      const key = `${q.question.toLowerCase()}|${q.options.join("|").toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
  return fallbackQuestions({
    examName: args.examName,
    topic: args.topic,
    subject: args.subject,
    count: args.count,
    syllabus: args.syllabus
  });
}
