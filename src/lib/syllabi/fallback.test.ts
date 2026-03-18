import { describe, expect, it } from "vitest";
import { getFallbackTopics } from "@/lib/syllabi/fallback";

describe("syllabi fallback topics", () => {
  it("provides seeded ICAN topics for foundation level", () => {
    const topics = getFallbackTopics("ican", "Foundation Level");

    expect(topics).toBeTruthy();
    expect(topics?.length).toBeGreaterThan(0);
    expect(topics?.[0]?.title).toContain("Financial");
  });

  it("matches seeded ICAN fallback subjects case-insensitively", () => {
    const topics = getFallbackTopics("ICAN", "professional level");

    expect(topics).toBeTruthy();
    expect(topics?.some((topic) => topic.title.includes("Strategic"))).toBe(true);
  });
});
