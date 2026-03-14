import type { Json } from "@/lib/backend/database.types";
import { seedSyllabiNG } from "@/data/seed/exams";

export type Topic = {
  title: string;
  path: string;
  subtopics?: string[];
  resources?: Array<{ title: string; url: string }>;
};

type TopicBlueprint = Array<{ title: string; subtopics: string[] }>;

function normalizeSubject(value: string) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function fromBlueprint(_subject: string, blueprint: TopicBlueprint): Topic[] {
  return blueprint.map((topic) => ({
    title: topic.title,
    path: topic.title,
    subtopics: topic.subtopics
  }));
}

const nigerianExamSlugs = new Set(["waec", "neco", "jamb"]);

const nigerianBlueprints: Record<string, TopicBlueprint> = {
  englishlanguage: [
    { title: "Comprehension", subtopics: ["Main idea", "Inference", "Tone"] },
    { title: "Lexis and Structure", subtopics: ["Grammar", "Vocabulary", "Sentence completion"] },
    { title: "Oral English", subtopics: ["Stress", "Consonants", "Vowels"] },
    { title: "Summary", subtopics: ["Key points", "Paraphrasing", "Concision"] },
    { title: "Essay Writing", subtopics: ["Narrative", "Argumentative", "Formal letter"] }
  ],
  mathematics: [
    { title: "Number and Numeration", subtopics: ["Fractions", "Indices", "Logarithms"] },
    { title: "Algebra", subtopics: ["Expressions", "Equations", "Inequalities"] },
    { title: "Geometry", subtopics: ["Angles", "Triangles", "Circle theorems"] },
    { title: "Trigonometry", subtopics: ["Ratios", "Identities", "Applications"] },
    { title: "Statistics and Probability", subtopics: ["Averages", "Dispersion", "Probability"] }
  ],
  furthermathematics: [
    { title: "Advanced Algebra", subtopics: ["Polynomials", "Sequences", "Series"] },
    { title: "Calculus", subtopics: ["Limits", "Differentiation", "Integration"] },
    { title: "Matrices and Vectors", subtopics: ["Operations", "Determinants", "Applications"] },
    { title: "Mechanics", subtopics: ["Motion", "Forces", "Projectiles"] },
    { title: "Statistics", subtopics: ["Distributions", "Correlation", "Regression"] }
  ],
  physics: [
    { title: "Mechanics", subtopics: ["Motion", "Forces", "Energy"] },
    { title: "Waves", subtopics: ["Properties", "Sound", "Light"] },
    { title: "Electricity", subtopics: ["Current", "Circuits", "Ohm's law"] },
    { title: "Magnetism", subtopics: ["Fields", "Electromagnetism", "Induction"] },
    { title: "Modern Physics", subtopics: ["Atoms", "Radioactivity", "Nuclear concepts"] }
  ],
  chemistry: [
    { title: "Atomic Structure", subtopics: ["Atoms", "Electronic configuration", "Periodic trends"] },
    { title: "Bonding", subtopics: ["Ionic", "Covalent", "Intermolecular forces"] },
    { title: "Stoichiometry", subtopics: ["Mole concept", "Gas laws", "Calculations"] },
    { title: "Acids, Bases and Salts", subtopics: ["pH", "Titration", "Neutralization"] },
    { title: "Organic Chemistry", subtopics: ["Hydrocarbons", "Functional groups", "Reactions"] }
  ],
  biology: [
    { title: "Cell Biology", subtopics: ["Cell structure", "Transport", "Cell division"] },
    { title: "Genetics", subtopics: ["Inheritance", "Variation", "DNA basics"] },
    { title: "Ecology", subtopics: ["Ecosystems", "Food chains", "Conservation"] },
    { title: "Human Physiology", subtopics: ["Circulatory", "Respiratory", "Excretory"] },
    { title: "Plant Biology", subtopics: ["Photosynthesis", "Transport", "Reproduction"] }
  ],
  economics: [
    { title: "Basic Concepts", subtopics: ["Scarcity", "Choice", "Opportunity cost"] },
    { title: "Demand and Supply", subtopics: ["Determinants", "Elasticity", "Equilibrium"] },
    { title: "Production and Cost", subtopics: ["Factors", "Cost curves", "Revenue"] },
    { title: "Market Structures", subtopics: ["Competition", "Monopoly", "Oligopoly"] },
    { title: "Money and National Income", subtopics: ["Banking", "Inflation", "GDP"] }
  ],
  government: [
    { title: "Political Concepts", subtopics: ["State", "Power", "Legitimacy"] },
    { title: "Constitutional Development", subtopics: ["Colonial era", "Republics", "Military rule"] },
    { title: "Institutions", subtopics: ["Legislature", "Executive", "Judiciary"] },
    { title: "Public Administration", subtopics: ["Civil service", "Policy", "Accountability"] },
    { title: "International Relations", subtopics: ["Foreign policy", "ECOWAS", "AU"] }
  ],
  geography: [
    { title: "Map Reading", subtopics: ["Scale", "Direction", "Contours"] },
    { title: "Physical Geography", subtopics: ["Landforms", "Climate", "Vegetation"] },
    { title: "Human Geography", subtopics: ["Population", "Settlement", "Migration"] },
    { title: "Economic Geography", subtopics: ["Agriculture", "Transport", "Industry"] },
    { title: "Environmental Issues", subtopics: ["Erosion", "Pollution", "Conservation"] }
  ]
};

const nigerianDefault: TopicBlueprint = [
  { title: "Core concepts", subtopics: ["Key terms", "Foundations", "Principles"] },
  { title: "Methods", subtopics: ["Standard approach", "Worked examples", "Accuracy"] },
  { title: "Applications", subtopics: ["Past question patterns", "Interpretation", "Use cases"] },
  { title: "Common mistakes", subtopics: ["Frequent traps", "Correction", "Revision tips"] },
  { title: "Exam strategy", subtopics: ["Time management", "Speed", "Final revision"] }
];

export function getFallbackTopics(examSlug: string, subject: string): Topic[] | null {
  const examKey = String(examSlug).toLowerCase();
  const subjectKey = normalizeSubject(subject);

  const seeded = seedSyllabiNG.find(
    (item) => item.exam_slug.toLowerCase() === examKey && normalizeSubject(item.subject) === subjectKey
  );

  if (seeded?.topics?.length) return seeded.topics;

  if (nigerianExamSlugs.has(examKey)) {
    const blueprint = nigerianBlueprints[subjectKey] ?? nigerianDefault;
    return fromBlueprint(subject, blueprint);
  }

  return null;
}

const genericTopicBlueprints = [
  { title: "Foundations", subtopics: ["Core terms", "Basic concepts"] },
  { title: "Key principles", subtopics: ["Rules", "Patterns"] },
  { title: "Methods", subtopics: ["Standard approach", "Worked examples"] },
  { title: "Applications", subtopics: ["Real exam contexts", "Interpretation"] },
  { title: "Frequent mistakes", subtopics: ["Common traps", "How to avoid them"] },
  { title: "Advanced practice", subtopics: ["Mixed questions", "Timed drills"] }
];

export function getGenericTopicsForSubject(subject: string): Topic[] {
  const cleanSubject = String(subject || "Subject").trim();
  return genericTopicBlueprints.map((blueprint) => ({
    title: `${cleanSubject}: ${blueprint.title}`,
    path: blueprint.title,
    subtopics: blueprint.subtopics
  }));
}

export function topicsToJson(topics: Topic[]): Json {
  return topics as unknown as Json;
}
