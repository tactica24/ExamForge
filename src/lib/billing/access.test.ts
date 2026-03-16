import { describe, expect, it } from "vitest";
import {
  getTimedAccessDaysRemaining,
  getTimedAccessEndsAt,
  hasActiveProAccess,
  isFreeTrialActive
} from "@/lib/billing/access";

describe("hasActiveProAccess", () => {
  it("returns true when subscription tier is pro", () => {
    expect(
      hasActiveProAccess({
        subscription_tier: "pro",
        pro_until: null
      })
    ).toBe(true);
  });

  it("returns true when pro_until is in the future", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(
      hasActiveProAccess({
        subscription_tier: "free",
        pro_until: future
      })
    ).toBe(true);
  });

  it("returns false for expired or missing pro access", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(
      hasActiveProAccess({
        subscription_tier: "free",
        pro_until: past
      })
    ).toBe(false);
    expect(hasActiveProAccess(null)).toBe(false);
  });

  it("treats future timed access on free accounts as a trial", () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      isFreeTrialActive({
        subscription_tier: "free",
        pro_until: future
      })
    ).toBe(true);
    expect(getTimedAccessEndsAt({ subscription_tier: "free", pro_until: future })).toBeInstanceOf(Date);
    expect(getTimedAccessDaysRemaining({ subscription_tier: "free", pro_until: future })).toBeGreaterThanOrEqual(1);
  });
});
