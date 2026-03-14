import "server-only";

import { getServerEnv } from "@/lib/env";

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function getAwsBackendConfig() {
  const env = getServerEnv();

  return {
    backendProvider: env.APP_BACKEND_PROVIDER,
    cognitoRegion: cleanText(env.COGNITO_REGION),
    cognitoUserPoolId: cleanText(env.COGNITO_USER_POOL_ID),
    cognitoAppClientId: cleanText(env.COGNITO_APP_CLIENT_ID),
    cognitoAppClientSecret: cleanText(env.COGNITO_APP_CLIENT_SECRET),
    cognitoDomain: cleanText(env.COGNITO_DOMAIN),
    cognitoCallbackUrl: cleanText(env.COGNITO_CALLBACK_URL),
    cognitoLogoutUrl: cleanText(env.COGNITO_LOGOUT_URL),
    cognitoGoogleIdpName: cleanText(env.COGNITO_GOOGLE_IDP_NAME),
    appSessionSecret: cleanText(env.APP_SESSION_SECRET),
    auroraClusterArn: cleanText(env.AURORA_CLUSTER_ARN),
    auroraSecretArn: cleanText(env.AURORA_SECRET_ARN),
    auroraDatabase: cleanText(env.AURORA_DATABASE),
    s3BucketName: cleanText(env.S3_BUCKET_NAME),
    s3Region: cleanText(env.S3_REGION),
    s3PublicBaseUrl: cleanText(env.S3_PUBLIC_BASE_URL)
  };
}

export function isAwsBackendConfigured() {
  const cfg = getAwsBackendConfig();
  return Boolean(
    cfg.cognitoRegion &&
      cfg.cognitoUserPoolId &&
      cfg.cognitoAppClientId &&
      cfg.cognitoDomain &&
      cfg.cognitoCallbackUrl &&
      cfg.appSessionSecret &&
      cfg.auroraClusterArn &&
      cfg.auroraSecretArn &&
      cfg.auroraDatabase &&
      cfg.s3BucketName &&
      cfg.s3Region
  );
}
