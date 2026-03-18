import { NIGERIAN_EXAM_SUBJECTS } from "@/data/subjects";

export type SeedExam = {
  slug: string;
  name: string;
  country_code: string;
  description: string;
  subjects: string[];
  syllabus_sources: string[];
};

export const seedExamsNG: SeedExam[] = [
  {
    slug: "waec",
    name: "WAEC",
    country_code: "NG",
    description: "West African Senior School Certificate Examination preparation.",
    subjects: [...NIGERIAN_EXAM_SUBJECTS],
    syllabus_sources: ["https://www.waecnigeria.org/"]
  },
  {
    slug: "neco",
    name: "NECO",
    country_code: "NG",
    description: "National Examinations Council (SSCE) preparation.",
    subjects: [...NIGERIAN_EXAM_SUBJECTS],
    syllabus_sources: ["https://neco.gov.ng/"]
  },
  {
    slug: "jamb",
    name: "JAMB",
    country_code: "NG",
    description: "Unified Tertiary Matriculation Examination (UTME) prep.",
    subjects: [...NIGERIAN_EXAM_SUBJECTS],
    syllabus_sources: ["https://www.jamb.gov.ng/"]
  },
  {
    slug: "ielts",
    name: "IELTS",
    country_code: "INTL",
    description: "International English Language Testing System prep.",
    subjects: ["Listening", "Reading", "Writing", "Speaking"],
    syllabus_sources: ["https://www.ielts.org/"]
  },
  {
    slug: "acca",
    name: "ACCA",
    country_code: "INTL",
    description: "Association of Chartered Certified Accountants qualification.",
    subjects: ["BT", "MA", "FA", "LW", "PM", "TX", "FR", "AA", "FM"],
    syllabus_sources: ["https://www.accaglobal.com/"]
  },
  {
    slug: "ican",
    name: "ICAN",
    country_code: "NG",
    description: "Institute of Chartered Accountants of Nigeria qualification.",
    subjects: ["Foundation Level", "Skills Level", "Professional Level"],
    syllabus_sources: ["https://icanig.org/"]
  }
];

export type SeedSyllabus = {
  exam_slug: string;
  subject: string;
  topics: Array<{
    title: string;
    path: string;
    subtopics?: string[];
    resources?: Array<{ title: string; url: string }>;
  }>;
};

export const seedSyllabiNG: SeedSyllabus[] = [
  {
    exam_slug: "jamb",
    subject: "Mathematics",
    topics: [
      { title: "Algebra", path: "Algebra", subtopics: ["Linear equations", "Simultaneous equations"] },
      { title: "Geometry", path: "Geometry", subtopics: ["Angles", "Triangles", "Circles"] },
      { title: "Trigonometry", path: "Trigonometry", subtopics: ["Sine/Cosine/Tangent", "Angles of elevation"] },
      { title: "Statistics", path: "Statistics", subtopics: ["Mean/Median/Mode", "Probability basics"] }
    ]
  },
  {
    exam_slug: "waec",
    subject: "English Language",
    topics: [
      { title: "Comprehension", path: "Comprehension", subtopics: ["Main idea", "Inference"] },
      { title: "Lexis and Structure", path: "Lexis & Structure", subtopics: ["Grammar", "Vocabulary"] },
      { title: "Essay Writing", path: "Essay Writing", subtopics: ["Argumentative", "Narrative", "Expository"] }
    ]
  },
  {
    exam_slug: "ielts",
    subject: "Writing",
    topics: [
      { title: "Task 1 Reports", path: "Task 1", subtopics: ["Charts", "Maps", "Processes"] },
      { title: "Task 2 Essays", path: "Task 2", subtopics: ["Opinion", "Discussion", "Problem/Solution"] }
    ]
  },
  {
    exam_slug: "ican",
    subject: "Foundation Level",
    topics: [
      {
        title: "Financial Reporting Fundamentals",
        path: "Financial Reporting Fundamentals",
        subtopics: ["Accounting concepts", "Books of entry", "Trial balance"]
      },
      {
        title: "Quantitative Techniques",
        path: "Quantitative Techniques",
        subtopics: ["Percentages", "Ratios", "Business maths"]
      },
      {
        title: "Business and Commercial Law Basics",
        path: "Business and Commercial Law Basics",
        subtopics: ["Contracts", "Agency", "Company basics"]
      },
      {
        title: "Economics and Business Environment",
        path: "Economics and Business Environment",
        subtopics: ["Demand and supply", "Market structures", "Public policy"]
      },
      {
        title: "Management and Governance Basics",
        path: "Management and Governance Basics",
        subtopics: ["Planning", "Control", "Ethics"]
      }
    ]
  },
  {
    exam_slug: "ican",
    subject: "Skills Level",
    topics: [
      {
        title: "Financial Accounting and Reporting",
        path: "Financial Accounting and Reporting",
        subtopics: ["Preparation of accounts", "Adjustments", "Statement analysis"]
      },
      {
        title: "Taxation",
        path: "Taxation",
        subtopics: ["Personal tax", "Company tax", "VAT basics"]
      },
      {
        title: "Audit and Assurance",
        path: "Audit and Assurance",
        subtopics: ["Audit evidence", "Internal control", "Audit reports"]
      },
      {
        title: "Performance and Cost Management",
        path: "Performance and Cost Management",
        subtopics: ["Cost behaviour", "Budgeting", "Variance analysis"]
      },
      {
        title: "Public Sector and Finance",
        path: "Public Sector and Finance",
        subtopics: ["Government budgeting", "Public revenue", "Accountability"]
      }
    ]
  },
  {
    exam_slug: "ican",
    subject: "Professional Level",
    topics: [
      {
        title: "Strategic Financial Reporting",
        path: "Strategic Financial Reporting",
        subtopics: ["Group accounts", "Interpretation", "Disclosure issues"]
      },
      {
        title: "Strategic Financial Management",
        path: "Strategic Financial Management",
        subtopics: ["Investment appraisal", "Risk", "Funding decisions"]
      },
      {
        title: "Advanced Audit and Governance",
        path: "Advanced Audit and Governance",
        subtopics: ["Professional ethics", "Assurance strategy", "Corporate governance"]
      },
      {
        title: "Public Finance and Policy",
        path: "Public Finance and Policy",
        subtopics: ["Fiscal policy", "Public expenditure", "Accountability systems"]
      },
      {
        title: "Case Study and Advisory Skills",
        path: "Case Study and Advisory Skills",
        subtopics: ["Analysis", "Recommendation writing", "Professional judgement"]
      }
    ]
  }
];


