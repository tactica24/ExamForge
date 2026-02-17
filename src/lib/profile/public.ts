import "server-only";

import { createFirebaseServerClient } from "@/lib/firebase/server";

export async function syncProfilePublic(args: { userId: string }) {
  const firebase = await createFirebaseServerClient();
  const { data: profile } = await firebase
    .from("profiles")
    .select("display_name,name,leaderboard_anonymous")
    .eq("user_id", args.userId)
    .maybeSingle();

  const display =
    profile?.display_name?.trim() ||
    profile?.name?.trim() ||
    `Learner-${args.userId.slice(0, 6)}`;

  await firebase.from("profile_public").upsert(
    {
      user_id: args.userId,
      display_name: display,
      anonymous: Boolean(profile?.leaderboard_anonymous)
    },
    { onConflict: "user_id" }
  );

  return { display_name: display, anonymous: Boolean(profile?.leaderboard_anonymous) };
}
