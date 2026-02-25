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

function normalizeQuestionStem(value: string) {
  return normalizeText(value, 500).replace(/^\([^)]{2,80}\)\s*/g, "").trim();
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

function isLanguageSubject(subject: string) {
  return /(english|language|literature|verbal|comprehension|lexis|grammar)/i.test(subject);
}

function isAgricultureSubject(subject: string) {
  return /(agric|agriculture|animal husbandry|crop production|agricultural science)/i.test(subject);
}

function isDirectIndirectFocus(topic: string, focus: string) {
  return /(direct|indirect|reported speech)/i.test(`${topic} ${focus}`);
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
    question: `A value in ${args.focus} changes from ${base} to ${next}. What is the percentage increase?`,
    options: rotated,
    correct_index: (4 - correctIndex) % 4,
    explanation: `Percentage increase = ((${next} - ${base}) / ${base}) x 100 = ${percent}%.`
  };
}

function makeConceptFallback(args: { examName: string; subject: string; topic: string; focus: string }): GeneratedQuestion {
  return {
    question: `${args.focus} is best described as which of the following?`,
    options: [
      `The central principle that defines ${args.focus} in ${args.topic}.`,
      `A random strategy used only when answers are difficult.`,
      `Any option with technical words, even when the idea is unrelated.`,
      `A memory trick that replaces understanding of the concept.`
    ],
    correct_index: 0,
    explanation: `Exam questions on ${args.focus} are answered by applying the core concept, not by guessing strategies.`
  };
}

function makeApplicationFallback(args: { examName: string; subject: string; topic: string; focus: string }): GeneratedQuestion {
  return {
    question: `Which option shows a correct application of ${args.focus}?`,
    options: [
      `Apply the rule behind ${args.focus} and verify it matches the stem.`,
      "Ignore the rule and pick the option that sounds familiar.",
      "Choose the longest option without checking concept accuracy.",
      "Rely on speed alone and skip checking the key condition."
    ],
    correct_index: 0,
    explanation: `Correct application means using the governing rule and checking whether it fits the exact condition in the question.`
  };
}

function makeTrapFallback(args: { examName: string; subject: string; topic: string; focus: string }): GeneratedQuestion {
  return {
    question: `All the following are associated with ${args.focus} except _____.`,
    options: [
      `Its core rule in ${args.topic}.`,
      "Its common exam application pattern.",
      "Typical misconceptions linked to the concept.",
      "An unrelated idea outside the focus concept."
    ],
    correct_index: 3,
    explanation: `An EXCEPT item requires identifying the option that does not belong to the concept being tested.`
  };
}

function makeLanguageFallback(args: { topic: string; focus: string; index: number }): GeneratedQuestion {
  const directIndirectBank: GeneratedQuestion[] = [
    {
      question: 'Choose the correct indirect speech form of: "I am ready for the test," Tola said.',
      options: [
        "Tola said that she was ready for the test.",
        "Tola said that I am ready for the test.",
        "Tola says that she is ready for the test yesterday.",
        "Tola said she ready for the test."
      ],
      correct_index: 0,
      explanation:
        "In indirect speech, present tense in the quote usually backshifts to past when the reporting verb is past."
    },
    {
      question: "Select the direct speech form of this statement: Ada said that she had finished the assignment.",
      options: [
        'Ada said, "I finished the assignment."',
        'Ada said, "I had finished the assignment."',
        'Ada says, "She has finished the assignment."',
        'Ada said, "She had finish the assignment."'
      ],
      correct_index: 1,
      explanation: "The pronoun and tense should preserve the reported meaning accurately in direct speech."
    }
  ];

  const grammarBank: GeneratedQuestion[] = [
    {
      question: "Choose the option where the word in quotes is a noun.",
      options: [
        '"Honesty" is respected everywhere.',
        "She answered the question honestly.",
        "They moved quickly to the hall.",
        "The team played carefully."
      ],
      correct_index: 0,
      explanation: "A noun names a person, place, thing, or idea. 'Honesty' names an idea."
    },
    {
      question: "Choose the correct option to complete the sentence: Neither the principal nor the teachers _____ present.",
      options: ["is", "were", "was", "be"],
      correct_index: 1,
      explanation:
        "With 'neither...nor', agreement follows the noun closest to the verb. 'Teachers' is plural, so 'were' is correct."
    },
    {
      question: "Choose the option that best completes the sentence: By the time we arrived, the match _____.",
      options: ["has started", "had started", "was starting", "starts"],
      correct_index: 1,
      explanation: "Past perfect is used for an action completed before another action in the past."
    }
  ];

  const bank = isDirectIndirectFocus(args.topic, args.focus) ? directIndirectBank : grammarBank;
  return bank[args.index % bank.length] as GeneratedQuestion;
}

function makeAgricultureFallback(args: { index: number }): GeneratedQuestion {
  const bank: GeneratedQuestion[] = [
    {
      question: "Gummosis is mainly caused by a _____.",
      options: ["fungal infection", "vitamin deficiency", "wind pressure", "soil texture only"],
      correct_index: 0,
      explanation:
        "Gummosis in many crops is commonly linked to fungal pathogens, especially under poor management conditions."
    },
    {
      question: "The roles of government in agricultural development include the following except _____.",
      options: [
        "funding agricultural research",
        "providing extension services",
        "developing rural infrastructure",
        "doing manual weeding on every private farm"
      ],
      correct_index: 3,
      explanation:
        "Governments support policy, infrastructure, and extension, but they do not manually run every private farm activity."
    },
    {
      question: "The best farm tool for transplanting seedlings is a _____.",
      options: ["hand trowel", "cutlass", "ridger", "disc plough"],
      correct_index: 0,
      explanation: "A hand trowel is suitable for lifting and transplanting seedlings with minimal root damage."
    }
  ];
  return bank[args.index % bank.length] as GeneratedQuestion;
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
  const q = normalizeQuestionStem(value.question).toLowerCase();
  const options = (value.options ?? []).map((option) => normalizeText(option, 140).toLowerCase());
  if (!q) return true;
  if (/practice question\s*\d+/i.test(q)) return true;
  if (/which option best fits/i.test(q)) return true;
  if (/in an objective item on/i.test(q)) return true;
  if (/which option best explains/i.test(q)) return true;
  if (/what should you do first to avoid common traps/i.test(q)) return true;
  if (/which choice is the most reliable strategy/i.test(q)) return true;
  if (/^\([^)]{3,80}\)\s*/i.test(q)) return true;
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
  const isLanguage = isLanguageSubject(args.subject);
  const isAgric = isAgricultureSubject(args.subject);

  const questions: GeneratedQuestion[] = [];
  for (let i = 0; i < amount; i += 1) {
    const focus = focuses[i] ?? baseTopicLabel(args.topic);
    const variant = i % 3;
    const base =
      isLanguage
        ? makeLanguageFallback({
            topic: args.topic,
            focus,
            index: i
          })
        : isAgric
          ? makeAgricultureFallback({ index: i })
          : isQuant && i % 2 === 0
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
      question: normalizeQuestionStem(q.question),
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
    "You generate high-quality WAEC/NECO/JAMB-style objective exam prep questions.",
    "Question stems must look like real exam items, not study advice.",
    "Never use meta phrasing such as 'In an objective item...' or 'what should you do first to avoid common traps'.",
    "Never prefix stems with exam labels like '(NECO English Language)'.",
    "Use direct exam stem forms: definition, completion, cause/effect, except/not, best tool/method, and short scenario application.",
    "For English/Language topics, prefer sentence-based grammar and usage stems over abstract strategy wording.",
    "Each item must test subject knowledge, not test-taking strategy.",
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
          question: "string (direct exam-style stem)",
          options: ["string", "string", "string", "string"],
          correct_index: 0,
          explanation: "string"
        }
      ]
    },
    style_examples: [
      "Gummosis is caused by a _____.",
      "The roles of government in agricultural development include the following except _____.",
      "The best farm tool for transplanting seedlings is _____.",
      'Choose the correct indirect speech form of: "..."'
    ],
    constraints: [
      `Return exactly ${args.count} unique questions.`,
      "No exam/subject prefix in question stems.",
      "No meta stem wording (no advice-style questions).",
      "Options must be plausible and unique.",
      "correct_index must be 0..3.",
      "Use clear Nigerian/International English (no slang).",
      "Include brief explanations.",
      "Cover a spread of factual, conceptual, application, and except/not questions.",
      "Avoid placeholders such as 'Option A/B/C/D' in option text."
    ]
  };

  const response = await generateJsonWithFallback<any>({
    system,
    user: `Generate questions as JSON:\n${JSON.stringify(user)}`,
    temperature: 0.4,
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
