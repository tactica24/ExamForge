import { assignImportedQuestionTarget, parseImportedQuestions, reviewImportedQuestion } from "@/lib/question-bank/import";

describe("question bank import helpers", () => {
  it("parses fenced JSON and resolves answer letters", () => {
    const parsed = parseImportedQuestions(`\`\`\`json
[
  {
    "question": "What is the capital of France?",
    "options": ["Berlin", "Madrid", "Paris", "Rome"],
    "answer": "C",
    "explanation": "Paris is the capital city of France.",
    "difficulty": "easy"
  }
]
\`\`\``);

    expect(parsed.totalSubmitted).toBe(1);
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.questions[0]?.correct_index).toBe(2);
    expect(parsed.questions[0]?.difficulty).toBe("easy");
  });

  it("assigns imported questions to the closest syllabus target", () => {
    const parsed = parseImportedQuestions(`[
      {
        "question": "Which organelle is known as the powerhouse of the cell?",
        "options": ["Nucleus", "Mitochondrion", "Ribosome", "Golgi apparatus"],
        "answer": "B",
        "explanation": "The mitochondrion produces most of the cell's ATP."
      }
    ]`);

    const target = assignImportedQuestionTarget({
      question: parsed.questions[0]!,
      subject: "Biology",
      targets: [
        {
          topicPath: "Cell Biology",
          topicKey: "cell-biology",
          focusLabel: "Cell structure",
          focusKey: "cell-structure",
          syllabus: ["Cell Biology", "Cell structure", "Organelles"],
          syllabusTags: ["cell", "biology", "structure", "organelles", "mitochondrion"]
        },
        {
          topicPath: "Ecology",
          topicKey: "ecology",
          focusLabel: "Food chains",
          focusKey: "food-chains",
          syllabus: ["Ecology", "Food chains"],
          syllabusTags: ["ecology", "food", "chains", "habitat"]
        }
      ]
    });

    expect(target.topicPath).toBe("Cell Biology");
    expect(target.focusLabel).toBe("Cell structure");
  });

  it("flags weak imports for review when topic alignment is poor", () => {
    const review = reviewImportedQuestion({
      question: {
        question: "A random sentence without clear syllabus alignment?",
        options: ["One", "Two", "Three", "Four"],
        correct_index: 0,
        explanation: "Short explanation only."
      },
      subject: "Biology",
      topicPath: "Cell Biology",
      focusLabel: "Cell structure",
      syllabusTags: ["cell", "structure", "biology"],
      approvalThreshold: 76
    });

    expect(["needs_review", "rejected"]).toContain(review.reviewStatus);
  });
});
