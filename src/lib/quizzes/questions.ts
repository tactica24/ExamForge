import "server-only";

import { languageInstruction } from "@/lib/ai/language";
import { generateJsonWithFallback } from "@/lib/ai/multi";

export type GeneratedQuestion = {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
};

type SubjectFamily =
  | "mathematics"
  | "language"
  | "world_language"
  | "biology"
  | "agriculture"
  | "economics"
  | "physical_science"
  | "social_science"
  | "geography"
  | "religion"
  | "computing"
  | "business"
  | "arts"
  | "vocational"
  | "professional"
  | "general";

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

  if (!seed.length) return Array.from({ length: count }, () => "Main topic");

  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(seed[i % seed.length]);
  }
  return out;
}

function questionSignature(question: Pick<GeneratedQuestion, "question" | "options">) {
  return `${normalizeQuestionStem(question.question).toLowerCase()}|${question.options
    .map((option) => normalizeText(option, 140).toLowerCase())
    .join("|")}`;
}

function dedupeQuestions(questions: GeneratedQuestion[]) {
  const seen = new Set<string>();
  const out: GeneratedQuestion[] = [];

  for (const question of questions) {
    const signature = questionSignature(question);
    if (!signature || seen.has(signature)) continue;
    seen.add(signature);
    out.push(question);
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

function isBiologySubject(subject: string) {
  return /(biology|basic science|combined science|life science)/i.test(subject);
}

function isEconomicsSubject(subject: string) {
  return /(economics|commerce|business studies|marketing)/i.test(subject);
}

function isWorldLanguageSubject(subject: string) {
  return /(french|arabic|hausa|igbo|yoruba)/i.test(subject);
}

function isPhysicalScienceSubject(subject: string) {
  return /(physics|chemistry)/i.test(subject);
}

function isSocialScienceSubject(subject: string) {
  return /(government|civic education|history|social studies|current affairs)/i.test(subject);
}

function isGeographySubject(subject: string) {
  return /(geography|environmental)/i.test(subject);
}

function isReligiousSubject(subject: string) {
  return /(christian religious|islamic religious|religious studies|crs|irs)/i.test(subject);
}

function isComputingSubject(subject: string) {
  return /(computer|data processing|ict|information technology)/i.test(subject);
}

function isBusinessSubject(subject: string) {
  return /(financial accounting|accounting|commerce|business studies|book-keeping|bookkeeping)/i.test(subject);
}

function isArtsSubject(subject: string) {
  return /(literature|visual arts|fine arts|music)/i.test(subject);
}

function isVocationalSubject(subject: string) {
  return /(home economics|food and nutrition|technical drawing)/i.test(subject);
}

function isProfessionalSubject(subject: string) {
  return /^(bt|ma|fa|lw|pm|tx|fr|aa|fm)$/i.test(subject) || /(foundation level|skills level|professional level|acca|ican)/i.test(subject);
}

function getSubjectFamily(subject: string): SubjectFamily {
  if (isLanguageSubject(subject)) return "language";
  if (isWorldLanguageSubject(subject)) return "world_language";
  if (isBiologySubject(subject)) return "biology";
  if (isAgricultureSubject(subject)) return "agriculture";
  if (isEconomicsSubject(subject)) return "economics";
  if (isPhysicalScienceSubject(subject)) return "physical_science";
  if (isSocialScienceSubject(subject)) return "social_science";
  if (isGeographySubject(subject)) return "geography";
  if (isReligiousSubject(subject)) return "religion";
  if (isComputingSubject(subject)) return "computing";
  if (isBusinessSubject(subject)) return "business";
  if (isArtsSubject(subject)) return "arts";
  if (isVocationalSubject(subject)) return "vocational";
  if (isProfessionalSubject(subject)) return "professional";
  if (isQuantSubject(subject)) return "mathematics";
  return "general";
}

function subjectStyleInstruction(subject: string) {
  switch (getSubjectFamily(subject)) {
    case "mathematics":
      return [
        "Write standard objective items involving calculation, algebraic manipulation, geometry, statistics, probability, or short quantitative word problems as appropriate.",
        "Use proper symbols and mathematical language.",
        "Each item must have one clearly correct numerical or logical answer."
      ].join("\n");
    case "language":
      return [
        "Use sentence-based grammar, comprehension, lexis, structure, interpretation, and usage questions.",
        "Keep them in the style of English language objective papers."
      ].join("\n");
    case "world_language":
      return [
        "Use objective questions based on vocabulary, grammar, translation, comprehension, and sentence meaning for the target language.",
        "The question should feel like a real language-paper multiple choice item, not a study tip."
      ].join("\n");
    case "biology":
      return [
        "Ask concrete factual and process-based life-science questions.",
        "Use authentic terms such as cell, tissue, enzyme, adaptation, reproduction, ecology, and physiology when relevant."
      ].join("\n");
    case "agriculture":
      return [
        "Use real agricultural science objective items around crops, livestock, farm tools, soil, pests, diseases, and agricultural practices."
      ].join("\n");
    case "economics":
      return [
        "Ask standard principle/application items using demand, supply, cost, revenue, inflation, budgeting, production, taxation, and market behavior when relevant."
      ].join("\n");
    case "physical_science":
      return [
        "Use proper science questions involving concepts, laws, reactions, measurements, calculations, laboratory observations, and applications.",
        "Keep the wording concrete and textbook-accurate."
      ].join("\n");
    case "social_science":
      return [
        "Use definitional, institutional, constitutional, historical, and short scenario questions appropriate to government, civics, and history papers."
      ].join("\n");
    case "geography":
      return [
        "Use geography objective items on map reading, physical geography, human geography, climate, drainage, settlement, transport, and environment."
      ].join("\n");
    case "religion":
      return [
        "Use factual and interpretive questions on beliefs, teachings, practices, texts, prophets, and moral lessons appropriate to the syllabus."
      ].join("\n");
    case "computing":
      return [
        "Use ICT/computer objective items involving hardware, software, data representation, operating systems, networking, and basic applications."
      ].join("\n");
    case "business":
      return [
        "Use accounting, commerce, and business objective items involving source documents, books of account, trial balance, trade, office practice, and business transactions."
      ].join("\n");
    case "arts":
      return [
        "Use literature, art, or music objective items involving terminology, forms, appreciation, devices, and interpretation as appropriate."
      ].join("\n");
    case "vocational":
      return [
        "Use practical home economics, food and nutrition, or technical drawing objective items based on tools, processes, materials, hygiene, nutrients, and conventions."
      ].join("\n");
    case "professional":
      return [
        "Use professional-style multiple choice items grounded in the exam syllabus, with realistic business, law, audit, finance, tax, reporting, or management contexts."
      ].join("\n");
    default:
      return [
        "Write authentic syllabus-based objective items with concrete facts, short scenarios, or direct definitions.",
        "Avoid generic coaching language and vague conceptual filler."
      ].join("\n");
  }
}

function subjectStyleExamples(subject: string) {
  switch (getSubjectFamily(subject)) {
    case "mathematics":
      return [
        "Find the value of x if 3x - 7 = 11.",
        "The mean of 4, 6, 8 and 12 is _____.",
        "A trader buys an item for N240 and sells it for N300. Find the percentage profit.",
        "If sin 30 degrees = _____."
      ];
    case "language":
      return [
        'Choose the correct indirect speech form of: "I am ready," Bisi said.',
        "Choose the option that best completes the sentence.",
        "Which of the following words is nearest in meaning to the underlined word?",
        "From the passage, the writer suggests that _____."
      ];
    case "world_language":
      return [
        "Choose the correct translation of the expression.",
        "Select the sentence with the correct grammatical form.",
        "Choose the option that best completes the dialogue.",
        "From the passage, the speaker implies that _____."
      ];
    case "biology":
      return [
        "The oxygen released during photosynthesis is derived from _____.",
        "A plant which grows on another plant without harming it is called _____.",
        "The site of aerobic respiration in the cell is the _____.",
        "Pollination is the transfer of pollen grains from the _____ to the _____."
      ];
    case "agriculture":
      return [
        "The best farm tool for transplanting seedlings is a _____.",
        "Gummosis is mainly caused by a _____.",
        "All the following are functions of farm records except _____.",
        "The method of controlling soil erosion on slopes is _____."
      ];
    case "economics":
      return [
        "A budget deficit occurs when government expenditure is _____ revenue.",
        "If price is fixed below equilibrium, the market will experience _____.",
        "Opportunity cost is the cost of the _____.",
        "An increase in supply, other things being equal, will lead to _____ price."
      ];
    case "physical_science":
      return [
        "The SI unit of force is the _____.",
        "The gas evolved when dilute hydrochloric acid reacts with zinc is _____.",
        "A body moving with uniform velocity has _____ acceleration.",
        "The process by which a solid changes directly into gas is called _____."
      ];
    case "social_science":
      return [
        "The arm of government responsible for interpreting laws is the _____.",
        "A democratic system of government is based on the principle of _____.",
        "One major function of the legislature is to _____.",
        "The policy of non-alignment means _____."
      ];
    case "geography":
      return [
        "Contour lines that are very close together indicate a _____ slope.",
        "Rainfall caused by relief is called _____ rainfall.",
        "The instrument used for measuring atmospheric pressure is the _____.",
        "A town that grows around a mining activity is a _____ settlement."
      ];
    case "religion":
      return [
        "One lesson from the parable is that _____.",
        "The Hijrah refers to the _____.",
        "A major teaching of the prophets is _____.",
        "The moral lesson in the passage is _____."
      ];
    case "computing":
      return [
        "The part of the computer that performs arithmetic and logical operations is the _____.",
        "An example of an output device is the _____.",
        "A collection of related data is called a _____.",
        "The protocol used for browsing web pages is _____."
      ];
    case "business":
      return [
        "A source document used to support goods returned to the supplier is the _____.",
        "The difference between assets and liabilities is _____.",
        "The book used for recording credit sales is the _____.",
        "A trial balance is prepared mainly to test the _____ of entries."
      ];
    case "arts":
      return [
        "A figure of speech in which a non-human object is given human qualities is _____.",
        "The highest male singing voice is the _____.",
        "A tragedy is a literary work that mainly presents _____.",
        "One element of art is _____."
      ];
    case "vocational":
      return [
        "A major body-building nutrient is _____.",
        "The drawing instrument used for producing circles is the _____.",
        "One function of roughage in food is to _____.",
        "Personal hygiene helps to prevent _____."
      ];
    case "professional":
      return [
        "A company with gross profit margin falling while revenue grows should first review _____.",
        "The main purpose of an audit working paper is to _____.",
        "A deferred tax liability arises when _____.",
        "The net present value of a project depends mainly on _____."
      ];
    default:
      return [
        "Find the correct answer to the question.",
        "Choose the option that best completes the statement.",
        "Which of the following is correct?",
        "All the following are true except _____."
      ];
  }
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

function makeMathLinearFallback(index: number): GeneratedQuestion {
  const x = 3 + (index % 6);
  const a = 2 + (index % 4);
  const b = 3 + ((index + 1) % 5);
  const c = a * x + b;
  const options = [x, x + 1, x - 1, x + 2].map((value) => String(value));
  const correctIndex = index % 4;
  const rotated = options.slice(correctIndex).concat(options.slice(0, correctIndex));

  return {
    question: `If ${a}x + ${b} = ${c}, find x.`,
    options: rotated,
    correct_index: (4 - correctIndex) % 4,
    explanation: `Subtract ${b} from both sides to get ${a}x = ${c - b}. Then divide by ${a} to obtain x = ${x}.`
  };
}

function makeMathPercentFallback(index: number): GeneratedQuestion {
  const oldValue = 40 + index * 5;
  const increase = 10 + (index % 5) * 5;
  const newValue = oldValue + increase;
  const percent = Math.round((increase / oldValue) * 100);
  const baseOptions = [`${percent}%`, `${percent + 5}%`, `${Math.max(1, percent - 5)}%`, `${percent + 10}%`];
  const shift = index % 4;
  const options = baseOptions.slice(shift).concat(baseOptions.slice(0, shift));

  return {
    question: `A quantity increases from ${oldValue} to ${newValue}. What is the percentage increase?`,
    options,
    correct_index: (4 - shift) % 4,
    explanation: `Increase = ${newValue - oldValue}. Percentage increase = (${newValue - oldValue}/${oldValue}) x 100 = ${percent}%.`
  };
}

function makeMathWordFallback(index: number): GeneratedQuestion {
  const mangoes = 12 + index;
  const oranges = 8 + (index % 4);
  const total = mangoes + oranges;
  const baseOptions = [String(total), String(total - 2), String(total + 3), String(total + 5)];
  const shift = (index + 1) % 4;
  const options = baseOptions.slice(shift).concat(baseOptions.slice(0, shift));

  return {
    question: `A trader bought ${mangoes} mangoes and ${oranges} oranges. How many fruits did the trader buy altogether?`,
    options,
    correct_index: (4 - shift) % 4,
    explanation: `Total fruits = ${mangoes} + ${oranges} = ${total}.`
  };
}

function makeConceptFallback(args: { examName: string; subject: string; topic: string; focus: string }): GeneratedQuestion {
  return {
    question: `${args.focus} refers to _____.`,
    options: [
      `an established idea or process studied under ${args.topic}`,
      "a method of guessing when the answer is not known",
      "a list of unrelated examples put together at random",
      "an instruction used only during examinations"
    ],
    correct_index: 0,
    explanation: `${args.focus} should be treated as a real academic idea or process within the topic, not as exam technique.`
  };
}

function makeApplicationFallback(args: { examName: string; subject: string; topic: string; focus: string }): GeneratedQuestion {
  return {
    question: `Which statement best matches ${args.focus}?`,
    options: [
      `${args.focus} should be identified by its correct meaning or use within ${args.topic}.`,
      `${args.focus} can mean any related term in the same subject.`,
      `${args.focus} is answered correctly by choosing the longest option.`,
      `${args.focus} has no fixed meaning in the syllabus.`
    ],
    correct_index: 0,
    explanation: `A correct answer must match the accepted meaning or use of ${args.focus} within the topic.`
  };
}

function makeTrapFallback(args: { examName: string; subject: string; topic: string; focus: string }): GeneratedQuestion {
  return {
    question: `All the following may be linked with ${args.focus} except _____.`,
    options: [
      `a detail that belongs to ${args.topic}`,
      `an example that can reasonably fall under ${args.focus}`,
      `a term commonly discussed with ${args.focus}`,
      "an option that is clearly outside the topic area"
    ],
    correct_index: 3,
    explanation: `In an EXCEPT question, the correct answer is the option that does not belong to the topic being tested.`
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

function makeBiologyFallback(args: { topic: string; focus: string; index: number }): GeneratedQuestion {
  const bankByKeyword: Array<{ pattern: RegExp; bank: GeneratedQuestion[] }> = [
    {
      pattern: /(cell|organelle|tissue|membrane|nucleus|cytoplasm)/i,
      bank: [
        {
          question: "Which of the following controls the activities of the cell?",
          options: ["Nucleus", "Cell wall", "Vacuole", "Ribosome"],
          correct_index: 0,
          explanation: "The nucleus acts as the control center of the cell."
        },
        {
          question: "The site of aerobic respiration in the cell is the _____.",
          options: ["Mitochondrion", "Golgi apparatus", "Nucleus", "Centrosome"],
          correct_index: 0,
          explanation: "Aerobic respiration takes place mainly in the mitochondrion."
        },
        {
          question: "Movement of water molecules from a region of high concentration to a region of lower concentration through a partially permeable membrane is called _____.",
          options: ["Osmosis", "Diffusion", "Translocation", "Plasmolysis"],
          correct_index: 0,
          explanation: "Osmosis is the movement of water through a partially permeable membrane."
        }
      ]
    },
    {
      pattern: /(photo|chlorophyll|leaf|nutrition|plant|stomata)/i,
      bank: [
        {
          question: "The oxygen released during photosynthesis is derived from _____.",
          options: ["Water", "Carbon dioxide", "Sunlight", "Chlorophyll"],
          correct_index: 0,
          explanation: "The oxygen evolved in photosynthesis comes from water molecules."
        },
        {
          question: "Photosynthesis takes place mainly in the _____ of the leaf.",
          options: ["Chloroplasts", "Xylem vessels", "Guard cells", "Phloem tissues"],
          correct_index: 0,
          explanation: "Chloroplasts contain chlorophyll and are the main site of photosynthesis."
        },
        {
          question: "An opening through which gaseous exchange occurs in a leaf is called a _____.",
          options: ["Stoma", "Lenticel", "Vein", "Midrib"],
          correct_index: 0,
          explanation: "Stomata are pores in leaves used for gaseous exchange."
        }
      ]
    },
    {
      pattern: /(ecology|environment|habitat|symbiosis|adaptation|population)/i,
      bank: [
        {
          question: "A plant which grows on another plant without apparent harm to the host is called _____.",
          options: ["Epiphyte", "Parasite", "Saprophyte", "Predator"],
          correct_index: 0,
          explanation: "An epiphyte grows on another plant for support without harming it."
        },
        {
          question: "The association in which both organisms benefit is known as _____.",
          options: ["Mutualism", "Parasitism", "Commensalism", "Predation"],
          correct_index: 0,
          explanation: "Mutualism is a symbiotic relationship in which both organisms benefit."
        },
        {
          question: "All the organisms of one species living in a given area form a _____.",
          options: ["Population", "Community", "Habitat", "Ecosystem"],
          correct_index: 0,
          explanation: "A population is made up of organisms of the same species in one area."
        }
      ]
    },
    {
      pattern: /(reproduction|fertilization|zygote|gamete|flower|seed)/i,
      bank: [
        {
          question: "Fusion of male and female gametes results in the formation of a _____.",
          options: ["Zygote", "Embryo", "Placenta", "Ovule"],
          correct_index: 0,
          explanation: "A zygote is formed when male and female gametes fuse."
        },
        {
          question: "The male reproductive part of a flower is the _____.",
          options: ["Stamen", "Pistil", "Sepal", "Petal"],
          correct_index: 0,
          explanation: "The stamen is the male reproductive structure of a flower."
        },
        {
          question: "Pollination is the transfer of pollen grains from the _____ to the _____.",
          options: ["Anther, stigma", "Stigma, ovary", "Petal, sepal", "Ovary, anther"],
          correct_index: 0,
          explanation: "Pollination is the transfer of pollen grains from the anther to the stigma."
        }
      ]
    }
  ];

  const source = `${args.topic} ${args.focus}`;
  const matched = bankByKeyword.find((entry) => entry.pattern.test(source));
  const bank = matched?.bank ?? [
    {
      question: "Which branch of biology deals with the study of living organisms and their interactions with the environment?",
      options: ["Ecology", "Genetics", "Anatomy", "Histology"],
      correct_index: 0,
      explanation: "Ecology deals with organisms and their environment."
    },
    {
      question: "The basic unit of life is the _____.",
      options: ["Cell", "Tissue", "Organ", "System"],
      correct_index: 0,
      explanation: "The cell is the basic structural and functional unit of life."
    },
    {
      question: "Enzymes are important in living cells because they _____.",
      options: [
        "speed up chemical reactions",
        "store hereditary information",
        "transport oxygen only",
        "prevent excretion"
      ],
      correct_index: 0,
      explanation: "Enzymes act as biological catalysts and speed up reactions."
    }
  ];

  return bank[args.index % bank.length] as GeneratedQuestion;
}

function makeEconomicsFallback(args: { topic: string; focus: string; index: number }): GeneratedQuestion {
  const bankByKeyword: Array<{ pattern: RegExp; bank: GeneratedQuestion[] }> = [
    {
      pattern: /(demand|supply|market|price|equilibrium)/i,
      bank: [
        {
          question: "If the government fixes price below the equilibrium level, the market will experience _____.",
          options: ["Excess demand", "Excess supply", "Price stability", "Higher equilibrium price"],
          correct_index: 0,
          explanation: "A price fixed below equilibrium causes shortage or excess demand."
        },
        {
          question: "An increase in supply, other things being equal, will normally lead to _____ price.",
          options: ["a lower", "a higher", "a fixed", "an unstable"],
          correct_index: 0,
          explanation: "An increase in supply usually reduces equilibrium price."
        },
        {
          question: "The point at which demand equals supply is known as the _____.",
          options: ["equilibrium point", "break-even point", "saturation point", "consumption point"],
          correct_index: 0,
          explanation: "Equilibrium occurs where quantity demanded equals quantity supplied."
        }
      ]
    },
    {
      pattern: /(budget|deficit|revenue|tax|government finance|fiscal)/i,
      bank: [
        {
          question: "A budget deficit occurs when government expenditure is _____ government revenue.",
          options: ["greater than", "equal to", "less than", "independent of"],
          correct_index: 0,
          explanation: "Budget deficit means spending exceeds revenue."
        },
        {
          question: "Tax imposed directly on personal income is known as _____.",
          options: ["direct tax", "indirect tax", "excise duty", "customs duty"],
          correct_index: 0,
          explanation: "Income tax is a direct tax."
        },
        {
          question: "Government spending and taxation are instruments of _____ policy.",
          options: ["fiscal", "monetary", "trade", "population"],
          correct_index: 0,
          explanation: "Fiscal policy deals with government expenditure and taxation."
        }
      ]
    },
    {
      pattern: /(money|bank|inflation|currency|credit)/i,
      bank: [
        {
          question: "A persistent rise in the general price level is called _____.",
          options: ["inflation", "deflation", "depression", "recession"],
          correct_index: 0,
          explanation: "Inflation is a sustained rise in the general price level."
        },
        {
          question: "The institution responsible for issuing currency in a country is the _____.",
          options: ["central bank", "commercial bank", "merchant bank", "development bank"],
          correct_index: 0,
          explanation: "The central bank issues currency and regulates money supply."
        },
        {
          question: "Money performs all the following functions except serving as _____.",
          options: ["a raw material for production", "a medium of exchange", "a store of value", "a unit of account"],
          correct_index: 0,
          explanation: "Money is not a raw material for production."
        }
      ]
    }
  ];

  const source = `${args.topic} ${args.focus}`;
  const matched = bankByKeyword.find((entry) => entry.pattern.test(source));
  const bank = matched?.bank ?? [
    {
      question: "The basic economic problem arises mainly because resources are _____.",
      options: ["scarce", "unlimited", "equally distributed", "always abundant"],
      correct_index: 0,
      explanation: "Resources are limited relative to human wants, giving rise to scarcity."
    },
    {
      question: "The reward for labour as a factor of production is _____.",
      options: ["wages", "rent", "interest", "profit"],
      correct_index: 0,
      explanation: "Labour earns wages."
    },
    {
      question: "Opportunity cost is the cost of the _____.",
      options: ["next best alternative forgone", "cheapest good purchased", "most profitable venture", "largest available output"],
      correct_index: 0,
      explanation: "Opportunity cost is the value of the next best alternative forgone."
    }
  ];

  return bank[args.index % bank.length] as GeneratedQuestion;
}

function makePhysicalScienceFallback(args: { subject: string; index: number }): GeneratedQuestion {
  const chemistryBank: GeneratedQuestion[] = [
    {
      question: "The gas produced when dilute hydrochloric acid reacts with zinc is _____.",
      options: ["hydrogen", "oxygen", "chlorine", "nitrogen"],
      correct_index: 0,
      explanation: "Zinc reacts with dilute hydrochloric acid to produce hydrogen gas."
    },
    {
      question: "A solution with pH less than 7 is _____.",
      options: ["acidic", "neutral", "alkaline", "buffered"],
      correct_index: 0,
      explanation: "Any solution with pH below 7 is acidic."
    },
    {
      question: "The smallest particle of an element that takes part in a chemical reaction is an _____.",
      options: ["atom", "ion", "molecule", "compound"],
      correct_index: 0,
      explanation: "An atom is the smallest particle of an element that can take part in chemical change."
    }
  ];

  const physicsBank: GeneratedQuestion[] = [
    {
      question: "The SI unit of force is the _____.",
      options: ["newton", "joule", "watt", "pascal"],
      correct_index: 0,
      explanation: "Force is measured in newtons."
    },
    {
      question: "A body moving with uniform velocity has _____ acceleration.",
      options: ["zero", "constant positive", "constant negative", "infinite"],
      correct_index: 0,
      explanation: "Uniform velocity means there is no change in velocity, so acceleration is zero."
    },
    {
      question: "The image formed by a plane mirror is always _____.",
      options: ["virtual", "real", "inverted", "magnified only"],
      correct_index: 0,
      explanation: "A plane mirror forms a virtual image."
    }
  ];

  const bank = /chem/i.test(args.subject) ? chemistryBank : physicsBank;
  return bank[args.index % bank.length] as GeneratedQuestion;
}

function makeSocialScienceFallback(args: { subject: string; index: number }): GeneratedQuestion {
  const historyBank: GeneratedQuestion[] = [
    {
      question: "History is mainly the study of _____.",
      options: ["past events", "future possibilities", "laboratory experiments", "imaginary societies"],
      correct_index: 0,
      explanation: "History deals primarily with past events."
    },
    {
      question: "An important use of historical evidence is to _____.",
      options: ["reconstruct past events", "predict weather exactly", "replace government laws", "measure rainfall"],
      correct_index: 0,
      explanation: "Historical evidence helps in reconstructing and understanding past events."
    },
    {
      question: "A written account of a person's life by another person is a _____.",
      options: ["biography", "autobiography", "chronicle", "memo"],
      correct_index: 0,
      explanation: "A biography is the life account of someone written by another person."
    }
  ];

  const govBank: GeneratedQuestion[] = [
    {
      question: "The arm of government responsible for interpreting laws is the _____.",
      options: ["judiciary", "executive", "legislature", "civil service"],
      correct_index: 0,
      explanation: "The judiciary interprets the law."
    },
    {
      question: "One major function of the legislature is to _____.",
      options: ["make laws", "enforce laws", "interpret laws", "prosecute offenders"],
      correct_index: 0,
      explanation: "The legislature is responsible for law making."
    },
    {
      question: "Democracy is best described as government by _____.",
      options: ["the people", "the army", "traditional rulers only", "judges alone"],
      correct_index: 0,
      explanation: "Democracy is government by the people either directly or through elected representatives."
    }
  ];

  const bank = /history/i.test(args.subject) ? historyBank : govBank;
  return bank[args.index % bank.length] as GeneratedQuestion;
}

function makeGeographyFallback(index: number): GeneratedQuestion {
  const bank: GeneratedQuestion[] = [
    {
      question: "Closely spaced contour lines on a map indicate a _____ slope.",
      options: ["steep", "gentle", "uniform", "concave"],
      correct_index: 0,
      explanation: "Contour lines close together indicate a steep slope."
    },
    {
      question: "Rainfall caused by moist air rising over highland is called _____ rainfall.",
      options: ["relief", "convectional", "cyclonic", "frontal"],
      correct_index: 0,
      explanation: "Relief rainfall occurs when moist air rises over high ground."
    },
    {
      question: "The instrument used for measuring atmospheric pressure is the _____.",
      options: ["barometer", "thermometer", "anemometer", "hygrometer"],
      correct_index: 0,
      explanation: "Atmospheric pressure is measured with a barometer."
    }
  ];
  return bank[index % bank.length] as GeneratedQuestion;
}

function makeReligiousFallback(index: number): GeneratedQuestion {
  const bank: GeneratedQuestion[] = [
    {
      question: "One major lesson from the teachings of the prophets is the need for _____.",
      options: ["righteous living", "idol worship", "injustice", "hatred"],
      correct_index: 0,
      explanation: "The prophets emphasized righteousness and upright living."
    },
    {
      question: "The Hijrah refers to the _____.",
      options: ["migration of Prophet Muhammad from Makkah to Madinah", "first revelation in the cave", "battle of Badr", "compilation of the Qur'an"],
      correct_index: 0,
      explanation: "Hijrah was the migration from Makkah to Madinah."
    },
    {
      question: "An important moral lesson from many scriptural accounts is the value of _____.",
      options: ["obedience to God", "pride", "oppression", "dishonesty"],
      correct_index: 0,
      explanation: "Many scriptural accounts teach obedience and faithfulness."
    }
  ];
  return bank[index % bank.length] as GeneratedQuestion;
}

function makeComputingFallback(index: number): GeneratedQuestion {
  const bank: GeneratedQuestion[] = [
    {
      question: "The part of the computer that performs arithmetic and logical operations is the _____.",
      options: ["ALU", "Monitor", "Keyboard", "Printer"],
      correct_index: 0,
      explanation: "The arithmetic and logic unit performs arithmetic and logical operations."
    },
    {
      question: "An example of an output device is the _____.",
      options: ["printer", "scanner", "mouse", "microphone"],
      correct_index: 0,
      explanation: "A printer is an output device."
    },
    {
      question: "A collection of related records is called a _____.",
      options: ["file", "bit", "worksheet", "browser"],
      correct_index: 0,
      explanation: "In data processing, a file is a collection of related records."
    }
  ];
  return bank[index % bank.length] as GeneratedQuestion;
}

function makeBusinessFallback(index: number): GeneratedQuestion {
  const bank: GeneratedQuestion[] = [
    {
      question: "The book used to record credit sales is the _____.",
      options: ["sales day book", "purchases day book", "cash book", "general journal"],
      correct_index: 0,
      explanation: "Credit sales are entered into the sales day book."
    },
    {
      question: "The excess of assets over liabilities is known as _____.",
      options: ["capital", "turnover", "discount", "drawings"],
      correct_index: 0,
      explanation: "Capital equals assets minus liabilities."
    },
    {
      question: "A source document used when goods are returned to a supplier is the _____.",
      options: ["debit note", "credit note", "receipt", "invoice"],
      correct_index: 0,
      explanation: "A debit note is issued when goods are returned to a supplier."
    }
  ];
  return bank[index % bank.length] as GeneratedQuestion;
}

function makeArtsFallback(index: number): GeneratedQuestion {
  const bank: GeneratedQuestion[] = [
    {
      question: "A figure of speech in which human qualities are given to non-human things is _____.",
      options: ["personification", "hyperbole", "apostrophe", "alliteration"],
      correct_index: 0,
      explanation: "Personification gives human qualities to non-human objects."
    },
    {
      question: "The highest male singing voice is the _____.",
      options: ["tenor", "bass", "alto", "baritone"],
      correct_index: 0,
      explanation: "Tenor is the highest normal male singing voice."
    },
    {
      question: "One of the elements of art is _____.",
      options: ["line", "chapter", "chorus", "stanza"],
      correct_index: 0,
      explanation: "Line is one of the basic elements of art."
    }
  ];
  return bank[index % bank.length] as GeneratedQuestion;
}

function makeVocationalFallback(index: number): GeneratedQuestion {
  const bank: GeneratedQuestion[] = [
    {
      question: "A major body-building nutrient is _____.",
      options: ["protein", "vitamin C", "roughage", "water vapour"],
      correct_index: 0,
      explanation: "Protein is a body-building nutrient."
    },
    {
      question: "The instrument used for drawing circles in technical drawing is the _____.",
      options: ["compass", "set square", "protractor", "T-square"],
      correct_index: 0,
      explanation: "A compass is used for drawing circles."
    },
    {
      question: "One importance of personal hygiene is the prevention of _____.",
      options: ["disease", "evaporation", "erosion", "inflation"],
      correct_index: 0,
      explanation: "Personal hygiene helps prevent disease."
    }
  ];
  return bank[index % bank.length] as GeneratedQuestion;
}

function makeProfessionalFallback(index: number): GeneratedQuestion {
  const bank: GeneratedQuestion[] = [
    {
      question: "The main purpose of an audit working paper is to _____.",
      options: ["provide evidence of work performed", "replace the financial statements", "prepare tax laws", "record directors' salaries only"],
      correct_index: 0,
      explanation: "Audit working papers provide evidence of the work performed and conclusions reached."
    },
    {
      question: "The net present value of a project depends mainly on the project's _____.",
      options: ["discounted cash flows", "number of employees", "registered address", "stock code"],
      correct_index: 0,
      explanation: "Net present value is based on discounted cash flows."
    },
    {
      question: "A deferred tax liability arises mainly from a _____ difference.",
      options: ["temporary", "permanent", "capital", "nominal"],
      correct_index: 0,
      explanation: "Deferred tax commonly arises from temporary differences."
    }
  ];
  return bank[index % bank.length] as GeneratedQuestion;
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
  if (/core concept|focus concept|common exam application|misconception|test-taking strategy|study advice/i.test(q)) return true;
  if (/all the following are associated with .* except/i.test(q) && options.some((option) => /core rule|misconception|application pattern|unrelated idea outside/i.test(option))) {
    return true;
  }
  if (options.length === 4 && options.every((option) => /^option [abcd](\b|\s|\()/.test(option))) return true;
  if (options.some((option) => /core rule|common exam application|misconception|focus concept|study advice|random strategy|longest option/i.test(option))) {
    return true;
  }
  return false;
}

export function fallbackQuestions(args: {
  examName: string;
  topic: string;
  subject: string;
  count: number;
  syllabus?: string[];
  difficulty?: "easy" | "medium" | "hard";
}): GeneratedQuestion[] {
  const amount = Math.max(1, Math.min(100, Math.trunc(args.count || 1)));
  const focuses = topicFocuses(args.topic, args.syllabus, amount);
  const family = getSubjectFamily(args.subject);

  const questions: GeneratedQuestion[] = [];
  for (let i = 0; i < amount; i += 1) {
    const focus = focuses[i] ?? baseTopicLabel(args.topic);
    const variant = i % 3;
    let base: GeneratedQuestion;

    if (family === "language" || family === "world_language") {
      base = makeLanguageFallback({
        topic: args.topic,
        focus,
        index: i
      });
    } else if (family === "agriculture") {
      base = makeAgricultureFallback({ index: i });
    } else if (family === "biology") {
      base = makeBiologyFallback({
        topic: args.topic,
        focus,
        index: i
      });
    } else if (family === "economics") {
      base = makeEconomicsFallback({
        topic: args.topic,
        focus,
        index: i
      });
    } else if (family === "physical_science") {
      base = makePhysicalScienceFallback({
        subject: args.subject,
        index: i
      });
    } else if (family === "social_science") {
      base = makeSocialScienceFallback({
        subject: args.subject,
        index: i
      });
    } else if (family === "geography") {
      base = makeGeographyFallback(i);
    } else if (family === "religion") {
      base = makeReligiousFallback(i);
    } else if (family === "computing") {
      base = makeComputingFallback(i);
    } else if (family === "business") {
      base = makeBusinessFallback(i);
    } else if (family === "arts") {
      base = makeArtsFallback(i);
    } else if (family === "vocational") {
      base = makeVocationalFallback(i);
    } else if (family === "professional") {
      base = makeProfessionalFallback(i);
    } else if (family === "mathematics" && i % 2 === 0) {
      base = i % 3 === 0 ? makeMathLinearFallback(i) : i % 3 === 1 ? makeMathPercentFallback(i) : makeMathWordFallback(i);
    } else if (family === "mathematics") {
      base = makeQuantFallback({
        examName: args.examName,
        subject: args.subject,
        topic: args.topic,
        focus,
        index: i
      });
    } else if (variant === 0) {
      base = makeConceptFallback({
        examName: args.examName,
        subject: args.subject,
        topic: args.topic,
        focus
      });
    } else if (variant === 1) {
      base = makeApplicationFallback({
        examName: args.examName,
        subject: args.subject,
        topic: args.topic,
        focus
      });
    } else {
      base = makeTrapFallback({
        examName: args.examName,
        subject: args.subject,
        topic: args.topic,
        focus
      });
    }

    const rotated = rotateQuestion({ base, step: i });
    questions.push(rotated);
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
      const key = questionSignature(q);
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
  difficulty?: "easy" | "medium" | "hard";
}): Promise<GeneratedQuestion[]> {
  const targetCount = Math.max(1, Math.min(100, Math.trunc(args.count || 1)));
  const lang = languageInstruction(args.preferredLanguage);
  const batchSize = Math.min(8, Math.max(4, targetCount >= 12 ? 6 : targetCount));
  const maxAttempts = Math.max(3, Math.ceil(targetCount / batchSize) + 2);
  const collected: GeneratedQuestion[] = [];

  for (let attempt = 0; attempt < maxAttempts && collected.length < targetCount; attempt += 1) {
    const remaining = targetCount - collected.length;
    const requestCount = Math.min(batchSize, remaining);
    const syllabusSlice =
      args.syllabus && args.syllabus.length
        ? args.syllabus.slice((attempt * requestCount) % args.syllabus.length, ((attempt * requestCount) % args.syllabus.length) + Math.min(12, requestCount * 2))
        : undefined;
    const effectiveSyllabus = syllabusSlice?.length ? syllabusSlice : args.syllabus;
    const syllabusHint =
      effectiveSyllabus && effectiveSyllabus.length
        ? args.strictSyllabus
          ? `Use only these topics/subtopics. Do not use any other topic:\n- ${effectiveSyllabus.join("\n- ")}`
          : `Stay as close as possible to these syllabus topics/subtopics:\n- ${effectiveSyllabus.join("\n- ")}`
        : "If no syllabus is provided, answer generally for the exam level.";

    const system = [
      "You generate high-quality objective exam questions for secondary-school and entrance-exam practice.",
      "Every item must read like a real exam question, not like teaching notes or study advice.",
      "Prefer concrete fact, calculation, definition, cause/effect, interpretation, or short scenario questions.",
      "Never use meta phrasing such as 'core concept', 'application pattern', 'misconception', 'study strategy', or 'focus concept'.",
      "Never prefix stems with labels like '(WAEC Biology)' or '(JAMB Mathematics)'.",
      "Use exactly 4 options per item.",
      "Make distractors academically plausible, not comic or obviously fake.",
      args.difficulty
        ? `Target difficulty: ${args.difficulty}. ${
            args.difficulty === "easy"
              ? "Prefer direct recall, straightforward application, and short calculations."
              : args.difficulty === "hard"
                ? "Prefer deeper reasoning, multi-step interpretation, or stronger distractors."
                : "Balance direct knowledge with moderate interpretation or calculation."
          }`
        : null,
      subjectStyleInstruction(args.subject),
      syllabusHint,
      lang
    ]
      .filter(Boolean)
      .join("\n");

    const user = {
      exam: args.examName,
      subject: args.subject,
      topic: args.topic,
      count: requestCount,
      avoid_questions: collected.slice(-12).map((question) => question.question),
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
      style_examples: subjectStyleExamples(args.subject),
      constraints: [
        `Return ${requestCount} unique questions if possible.`,
        "If one item is weak, replace it with a better one.",
        "No advice-style or study-skills wording.",
        "No generic filler options.",
        "Options must be distinct and plausible.",
        "correct_index must be 0..3.",
        "Include brief explanations."
      ]
    };

    const response = await generateJsonWithFallback<any>({
      system,
      user: `Generate questions as JSON:\n${JSON.stringify(user)}`,
      temperature: 0.25,
      validate: (parsed) => {
        const cleaned = normalizeQuestions(parsed);
        if (!cleaned.length) return null;
        return { questions: cleaned.slice(0, requestCount) };
      }
    });

    const cleaned = response.value?.questions ?? [];
    if (!cleaned.length) continue;

    const merged = dedupeQuestions([...collected, ...cleaned]);
    collected.splice(0, collected.length, ...merged);
  }

  if (collected.length >= targetCount) {
    return collected.slice(0, targetCount);
  }

  const fallback = fallbackQuestions({
    examName: args.examName,
    topic: args.topic,
    subject: args.subject,
    count: targetCount,
    syllabus: args.syllabus
  });

  return dedupeQuestions([...collected, ...fallback]).slice(0, targetCount);
}
