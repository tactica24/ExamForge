import { describe, expect, it } from "vitest";
import { generatePlanItemsFromTopics } from "./generate";

describe("generatePlanItemsFromTopics", () => {
  it("creates 1 topic per day for steady pace", () => {
    const items = generatePlanItemsFromTopics({
      pace: "steady",
      startDate: "2026-01-01",
      topics: [
        { title: "A", path: "A" },
        { title: "B", path: "B" },
        { title: "C", path: "C" }
      ]
    });
    expect(items).toHaveLength(3);
    expect(items[0]?.scheduled_for).toBe("2026-01-01");
    expect(items[1]?.scheduled_for).toBe("2026-01-02");
  });

  it("creates 2 topics per day for intensive pace", () => {
    const items = generatePlanItemsFromTopics({
      pace: "intensive",
      startDate: "2026-01-01",
      topics: [
        { title: "A", path: "A" },
        { title: "B", path: "B" },
        { title: "C", path: "C" }
      ]
    });
    expect(items).toHaveLength(3);
    expect(items[0]?.scheduled_for).toBe("2026-01-01");
    expect(items[1]?.scheduled_for).toBe("2026-01-01");
    expect(items[2]?.scheduled_for).toBe("2026-01-02");
  });

  it("supports 5 topics per day for advanced pacing", () => {
    const items = generatePlanItemsFromTopics({
      pace: "topics_5",
      startDate: "2026-01-01",
      topics: [
        { title: "A", path: "A" },
        { title: "B", path: "B" },
        { title: "C", path: "C" },
        { title: "D", path: "D" },
        { title: "E", path: "E" },
        { title: "F", path: "F" }
      ]
    });
    expect(items).toHaveLength(6);
    expect(items[0]?.scheduled_for).toBe("2026-01-01");
    expect(items[4]?.scheduled_for).toBe("2026-01-01");
    expect(items[5]?.scheduled_for).toBe("2026-01-02");
  });

  it("splits subtopic-heavy topics into focused daily units", () => {
    const items = generatePlanItemsFromTopics({
      pace: "steady",
      startDate: "2026-01-01",
      topics: [
        {
          title: "Number Properties",
          path: "Number Properties",
          subtopics: ["Integers", "Primes", "Factors", "Multiples"]
        }
      ]
    });

    expect(items).toHaveLength(2);
    expect(items[0]?.topic_path).toBe("Number Properties");
    expect(items[0]?.title).toContain("Focus:");
    expect(items[0]?.title).toContain("Integers");
    expect(items[0]?.title).toContain("Primes");
    expect(items[1]?.title).toContain("Factors");
    expect(items[1]?.title).toContain("Multiples");
    expect(items[0]?.scheduled_for).toBe("2026-01-01");
    expect(items[1]?.scheduled_for).toBe("2026-01-02");
  });

  it("increases per-day workload to meet target date window", () => {
    const items = generatePlanItemsFromTopics({
      pace: "steady",
      startDate: "2026-01-01",
      targetDate: "2026-01-02",
      topics: [
        { title: "A", path: "A" },
        { title: "B", path: "B" },
        { title: "C", path: "C" },
        { title: "D", path: "D" }
      ]
    });

    expect(items).toHaveLength(4);
    expect(items[0]?.scheduled_for).toBe("2026-01-01");
    expect(items[1]?.scheduled_for).toBe("2026-01-01");
    expect(items[2]?.scheduled_for).toBe("2026-01-02");
    expect(items[3]?.scheduled_for).toBe("2026-01-02");
  });
});
