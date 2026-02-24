import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { findTopicSubtopics } from "./topic-subtopics";

describe("findTopicSubtopics", () => {
  it("returns focused subtopics encoded in title", () => {
    const topics = [
      {
        title: "Number Properties",
        path: "Number Properties",
        subtopics: ["Integers", "Primes", "Factors", "Multiples"]
      }
    ];

    const result = findTopicSubtopics(topics, "Number Properties", "Number Properties (Focus: Integers + Primes)");
    expect(result).toEqual(["Integers", "Primes"]);
  });

  it("falls back to syllabus match when no focus metadata is present", () => {
    const topics = [
      {
        title: "Algebra",
        path: "Algebra",
        subtopics: ["Expressions", "Equations"]
      }
    ];

    const result = findTopicSubtopics(topics, "Algebra", "Algebra");
    expect(result).toEqual(["Expressions", "Equations"]);
  });
});
