import { describe, expect, it } from "vitest";
import {
  canUseFullAppFeatures,
  computeRollingProUntil,
  getBillingAccess,
  hasActiveProAccess
} from "@/lib/billing/access";

describe("billing access", () => {
  it("returns true when subscription tier is pro and there is no expiry yet", () => {
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

  it("does not treat expired pro windows as active", () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(
      hasActiveProAccess({
        subscription_tier: "pro",
        pro_until: past
      })
    ).toBe(false);
  });

  it("grants full access during the first three days after signup", () => {
    const recentSignup = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const access = getBillingAccess({
      subscription_tier: "free",
      pro_until: null,
      created_at: recentSignup
    });

    expect(access.status).toBe("trial");
    expect(access.isInFreeTrial).toBe(true);
    expect(canUseFullAppFeatures({ created_at: recentSignup })).toBe(true);
  });

  it("requires upgrade after the free trial ends", () => {
    const oldSignup = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const access = getBillingAccess({
      subscription_tier: "free",
      pro_until: null,
      created_at: oldSignup
    });

    expect(access.status).toBe("free");
    expect(access.requiresUpgrade).toBe(true);
    expect(access.canAccessMockExams).toBe(true);
  });

  it("extends rolling pro access from the later active period end", () => {
    const currentPeriodEnd = new Date("2026-03-20T10:00:00.000Z");
    const paidAt = new Date("2026-03-15T09:00:00.000Z");

    expect(
      computeRollingProUntil({
        currentPeriodEnd,
        startsAt: paidAt,
        durationDays: 30
      })
    ).toBe("2026-04-19T10:00:00.000Z");
  });
});
