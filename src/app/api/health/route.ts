import { NextResponse } from "next/server";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin-app";
import { getServerEnv } from "@/lib/env";

export async function GET(request: Request) {
  const hasFirebaseWebConfig = Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );

  const env = getServerEnv();
  const hasOpenAiKey = Boolean(env.OPENAI_API_KEY);
  const includeDiagnostics =
    process.env.NODE_ENV !== "production" ||
    (env.APP_CRON_SECRET &&
      request.headers.get("x-health-secret") === env.APP_CRON_SECRET);

  if (!includeDiagnostics) {
    return NextResponse.json({
      ok: true,
      name: "ace-naija",
      ts: new Date().toISOString()
    });
  }

  return NextResponse.json({
    ok: true,
    name: "ace-naija",
    ts: new Date().toISOString(),
    firebase: {
      webConfigReady: hasFirebaseWebConfig,
      adminReady: isFirebaseAdminConfigured()
    },
    ai: {
      openaiReady: hasOpenAiKey
    }
  });
}

