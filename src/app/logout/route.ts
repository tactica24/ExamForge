import { NextResponse } from "next/server";
import { createFirebaseServerClient } from "@/lib/firebase/server";

export async function POST() {
  const firebase = await createFirebaseServerClient();
  await firebase.auth.signOut();
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"), {
    status: 303
  });
}
