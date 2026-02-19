import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { processPendingAiJobs } from "@/lib/ai/jobs";

export async function GET(req: Request) {
  const env = getServerEnv();
  const secret = req.headers.get("x-cron-secret");
  if (!env.APP_CRON_SECRET || secret !== env.APP_CRON_SECRET) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 30);

  try {
    const result = await processPendingAiJobs({ limit });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: String(error?.message ?? "Failed to process AI jobs.") },
      { status: 500 }
    );
  }
}
