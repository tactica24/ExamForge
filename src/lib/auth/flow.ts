import "server-only";

import { addDays } from "date-fns";
import { getActivePlanForUser } from "@/lib/app/get-active-plan";
import { FREE_TRIAL_DAYS } from "@/lib/billing/access";
import { createFirebaseServerClient } from "@/lib/firebase/server";
import { syncProfilePublic } from "@/lib/profile/public";
import { resolvePostAuthPath } from "@/lib/auth/redirects";

type FirebaseServerClient = Awaited<ReturnType<typeof createFirebaseServerClient>>;

type SessionUser = {
  id: string;
  email: string | null;
  phone?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function pickFirstText(values: unknown[], maxLength: number) {
  for (const value of values) {
    const text = cleanText(value, maxLength);
    if (text) return text;
  }
  return "";
}

function uniqueStrings(value: unknown, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => cleanText(item, maxLength)).filter(Boolean)));
}

function metadataForUser(user: SessionUser): Record<string, unknown> {
  return user.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
}

function isAdminUser(user: SessionUser) {
  return (user.app_metadata as any)?.role === "admin";
}

function defaultNameForUser(user: SessionUser) {
  const metadata = metadataForUser(user);
  const emailLabel = cleanText(user.email?.split("@")[0], 60);
  return pickFirstText(
    [
      metadata.name,
      metadata.displayName,
      metadata.display_name,
      `${metadata.first_name ?? ""} ${metadata.surname ?? ""}`.trim(),
      emailLabel,
      "Learner"
    ],
    60
  );
}

function defaultAvatarUrlForUser(user: SessionUser) {
  const metadata = metadataForUser(user);
  const avatarUrl = pickFirstText(
    [metadata.picture, metadata.photoURL, metadata.photo_url, metadata.avatar_url],
    500
  );
  return /^https?:\/\//i.test(avatarUrl) ? avatarUrl : null;
}

async function readProfile(firebase: FirebaseServerClient, userId: string) {
  const { data: profile } = await firebase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  return profile;
}

export async function ensureProfileForUser(args: {
  firebase: FirebaseServerClient;
  user: SessionUser;
  profile?: any | null;
}) {
  const existingProfile = args.profile ?? (await readProfile(args.firebase, args.user.id));
  const metadata = metadataForUser(args.user);
  const defaultName = defaultNameForUser(args.user);
  const avatarUrl = defaultAvatarUrlForUser(args.user);

  if (existingProfile) {
    const update: Record<string, unknown> = {};

    if (!existingProfile.email && args.user.email) update.email = args.user.email;
    if (!existingProfile.phone && args.user.phone) update.phone = args.user.phone;
    if (!existingProfile.name && defaultName) update.name = defaultName;
    if (!(existingProfile as any).avatar_url && avatarUrl) update.avatar_url = avatarUrl;
    if (!existingProfile.subscription_tier) update.subscription_tier = "free";
    if (!existingProfile.preferred_explanation_language) update.preferred_explanation_language = "en";
    if (typeof existingProfile.low_data_mode !== "boolean") update.low_data_mode = false;
    if (typeof existingProfile.leaderboard_anonymous !== "boolean") update.leaderboard_anonymous = false;

    if (Object.keys(update).length) {
      await args.firebase.from("profiles").update(update).eq("user_id", args.user.id);
      if ("name" in update || "display_name" in update || "leaderboard_anonymous" in update) {
        await syncProfilePublic({ userId: args.user.id }).catch(() => {});
      }
      return { ...existingProfile, ...update };
    }

    return existingProfile;
  }

  const examInterestSlugs = uniqueStrings(
    metadata.exam_interest_slugs ?? metadata.exam_interests,
    80
  );

  const profile = {
    user_id: args.user.id,
    email: args.user.email ?? null,
    phone: args.user.phone ?? null,
    name: defaultName,
    display_name: null,
    avatar_url: avatarUrl,
    location: cleanText(metadata.location, 80) || null,
    timezone: cleanText(metadata.timezone, 60) || "Africa/Lagos",
    learning_style: cleanText(metadata.learning_style, 30) || "visual",
    level: cleanText(metadata.level, 30) || "beginner",
    subscription_tier: "free",
    preferred_explanation_language: cleanText(metadata.preferred_explanation_language, 20) || "en",
    low_data_mode: false,
    leaderboard_anonymous: false,
    pro_until: addDays(new Date(), FREE_TRIAL_DAYS).toISOString(),
    country: cleanText(metadata.country, 80) || null,
    state: cleanText(metadata.state, 80) || null,
    exam_interest_slugs: examInterestSlugs.length ? examInterestSlugs : undefined
  };

  await args.firebase.from("profiles").upsert(profile, { onConflict: "user_id" });
  await syncProfilePublic({ userId: args.user.id }).catch(() => {});

  return profile;
}

export async function hasCompletedOnboarding(args: {
  firebase: FirebaseServerClient;
  userId: string;
}) {
  const activePlan = await getActivePlanForUser(args.userId);
  return Boolean(activePlan);
}

export async function getUserAppState(args: {
  firebase: FirebaseServerClient;
  user: SessionUser;
}) {
  const admin = isAdminUser(args.user);
  const profilePromise = readProfile(args.firebase, args.user.id);

  if (admin) {
    return {
      profile: await profilePromise,
      isAdmin: true,
      hasCompletedOnboarding: true
    };
  }

  const [profile, completedOnboarding] = await Promise.all([
    profilePromise,
    hasCompletedOnboarding({
      firebase: args.firebase,
      userId: args.user.id
    })
  ]);

  return {
    profile: await ensureProfileForUser({
      firebase: args.firebase,
      user: args.user,
      profile
    }),
    isAdmin: false,
    hasCompletedOnboarding: completedOnboarding
  };
}

export async function getPostAuthPath(args: {
  firebase: FirebaseServerClient;
  user: SessionUser;
  nextPath?: string | null;
}) {
  const state = await getUserAppState({
    firebase: args.firebase,
    user: args.user
  });

  return resolvePostAuthPath({
    isAdmin: state.isAdmin,
    hasCompletedOnboarding: state.hasCompletedOnboarding,
    nextPath: args.nextPath
  });
}
