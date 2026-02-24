import { describe, expect, it } from "vitest";
import { describePace, paceFromTopicsPerDay, parseTopicsPerDay } from "./pace";

describe("plan pace helpers", () => {
  it("parses legacy and custom pace values", () => {
    expect(parseTopicsPerDay("steady")).toBe(1);
    expect(parseTopicsPerDay("intensive")).toBe(2);
    expect(parseTopicsPerDay("topics_5")).toBe(5);
    expect(parseTopicsPerDay("4/day")).toBe(4);
  });

  it("clamps out-of-range values", () => {
    expect(parseTopicsPerDay("topics_0")).toBe(1);
    expect(parseTopicsPerDay("topics_12")).toBe(5);
    expect(parseTopicsPerDay("unknown", 3)).toBe(3);
  });

  it("maps topics-per-day to pace labels", () => {
    expect(paceFromTopicsPerDay(1)).toBe("steady");
    expect(paceFromTopicsPerDay(2)).toBe("intensive");
    expect(paceFromTopicsPerDay(5)).toBe("topics_5");
    expect(describePace("topics_3")).toBe("3 topics/day");
  });
});
