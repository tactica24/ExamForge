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
