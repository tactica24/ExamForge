import "server-only";

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

export type AwsRuntimeCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string | null;
};

export function getAwsRuntimeCredentials(): AwsRuntimeCredentials {
  const accessKeyId =
    cleanText(process.env.AWS_APP_ACCESS_KEY_ID) ??
    cleanText(process.env.AWS_STORAGE_ACCESS_KEY_ID) ??
    cleanText(process.env.AWS_ACCESS_KEY_ID);
  const secretAccessKey =
    cleanText(process.env.AWS_APP_SECRET_ACCESS_KEY) ??
    cleanText(process.env.AWS_STORAGE_SECRET_ACCESS_KEY) ??
    cleanText(process.env.AWS_SECRET_ACCESS_KEY);
  const sessionToken =
    cleanText(process.env.AWS_APP_SESSION_TOKEN) ??
    cleanText(process.env.AWS_STORAGE_SESSION_TOKEN) ??
    cleanText(process.env.AWS_SESSION_TOKEN);

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS runtime credentials are not available for backend storage or data access.");
  }

  return {
    accessKeyId,
    secretAccessKey,
    sessionToken
  };
}

export function hasAwsRuntimeCredentials() {
  try {
    getAwsRuntimeCredentials();
    return true;
  } catch {
    return false;
  }
}
