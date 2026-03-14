import { NextResponse } from "next/server";
import { isAwsBackendConfigured } from "@/lib/aws/config";
import { getAppBackendProvider } from "@/lib/backend/provider";
import { isBackendStorageConfigured } from "@/lib/backend/storage";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "examforge",
    backendProvider: getAppBackendProvider(),
    awsBackendConfigured: isAwsBackendConfigured(),
    storageBackendConfigured: isBackendStorageConfigured(),
    phoneOtpEnabled: false,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  });
}
