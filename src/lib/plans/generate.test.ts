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
});
