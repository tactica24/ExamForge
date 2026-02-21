import { describe, expect, it } from "vitest";
import { hasActiveProAccess } from "@/lib/billing/access";

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
});
