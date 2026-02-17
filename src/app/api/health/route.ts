import { NextResponse } from "next/server";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin-app";

export async function GET() {
  const hasFirebaseWebConfig = Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );

  return NextResponse.json({
    ok: true,
    name: "ace-naija",
    ts: new Date().toISOString(),
    firebase: {
      webConfigReady: hasFirebaseWebConfig,
      adminReady: isFirebaseAdminConfigured()
    }
  });
}

