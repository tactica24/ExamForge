import { describe, expect, it } from "vitest";
import { resolvePostAuthPath, sanitizeNextPath } from "@/lib/auth/redirects";

describe("sanitizeNextPath", () => {
  it("keeps safe in-app paths", () => {
    expect(sanitizeNextPath("/dashboard?tab=today#top")).toBe("/dashboard?tab=today#top");
  });

  it("rejects malformed or unsafe paths", () => {
    expect(sanitizeNextPath("https://evil.example")).toBeNull();
    expect(sanitizeNextPath("//evil.example/path")).toBeNull();
    expect(sanitizeNextPath("/dashboard\\admin")).toBeNull();
    expect(sanitizeNextPath("/dashboard\n/admin")).toBeNull();
  });
});

describe("resolvePostAuthPath", () => {
  it("keeps admins on admin routes", () => {
    expect(
      resolvePostAuthPath({
        isAdmin: true,
        hasCompletedOnboarding: true,
        nextPath: "/admin/users"
      })
    ).toBe("/admin/users");
  });

  it("routes admins away from learner pages", () => {
    expect(
      resolvePostAuthPath({
        isAdmin: true,
        hasCompletedOnboarding: true,
        nextPath: "/dashboard"
      })
    ).toBe("/admin");
  });

  it("sends new learners into the dashboard/onboarding flow first", () => {
    expect(
      resolvePostAuthPath({
        isAdmin: false,
        hasCompletedOnboarding: false,
        nextPath: "/plan"
      })
    ).toBe("/dashboard");
    expect(
      resolvePostAuthPath({
        isAdmin: false,
        hasCompletedOnboarding: false,
        nextPath: "/onboarding"
      })
    ).toBe("/onboarding");
  });

  it("sends onboarded learners back to their requested app page", () => {
    expect(
      resolvePostAuthPath({
        isAdmin: false,
        hasCompletedOnboarding: true,
        nextPath: "/plan"
      })
    ).toBe("/plan");
  });

  it("keeps onboarded learners away from onboarding and admin routes", () => {
    expect(
      resolvePostAuthPath({
        isAdmin: false,
        hasCompletedOnboarding: true,
        nextPath: "/onboarding"
      })
    ).toBe("/dashboard");
    expect(
      resolvePostAuthPath({
        isAdmin: false,
        hasCompletedOnboarding: true,
        nextPath: "/admin"
      })
    ).toBe("/dashboard");
  });
});
