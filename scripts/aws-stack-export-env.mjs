#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return "";
  return String(process.argv[index + 1] ?? "").trim();
}

function quoteEnvValue(value) {
  return JSON.stringify(String(value));
}

function runAws(args) {
  return execFileSync("aws", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function ensureValue(map, key) {
  const value = String(map[key] ?? "").trim();
  if (!value) {
    throw new Error(`Missing required CloudFormation output: ${key}`);
  }
  return value;
}

const stackName = getArg("--stack-name");
const region = getArg("--region");
const outputPathArg = getArg("--out");

if (!stackName || !region) {
  console.error("Usage: node scripts/aws-stack-export-env.mjs --stack-name <name> --region <aws-region> [--out <file>]");
  process.exit(1);
}

const outputsJson = runAws([
  "cloudformation",
  "describe-stacks",
  "--stack-name",
  stackName,
  "--region",
  region,
  "--query",
  "Stacks[0].Outputs",
  "--output",
  "json"
]);

const outputs = JSON.parse(outputsJson);
const outputMap = Object.fromEntries(
  (Array.isArray(outputs) ? outputs : []).map((entry) => [String(entry.OutputKey ?? ""), String(entry.OutputValue ?? "")])
);

const appUrl = ensureValue(outputMap, "AppUrl");
const cognitoUserPoolId = ensureValue(outputMap, "CognitoUserPoolId");
const cognitoAppClientId = ensureValue(outputMap, "CognitoAppClientId");
const sessionSecretArn = ensureValue(outputMap, "SessionSecretArn");

const sessionSecret = runAws([
  "secretsmanager",
  "get-secret-value",
  "--secret-id",
  sessionSecretArn,
  "--region",
  region,
  "--query",
  "SecretString",
  "--output",
  "text"
]);

const cognitoAppClientSecret = runAws([
  "cognito-idp",
  "describe-user-pool-client",
  "--user-pool-id",
  cognitoUserPoolId,
  "--client-id",
  cognitoAppClientId,
  "--region",
  region,
  "--query",
  "UserPoolClient.ClientSecret",
  "--output",
  "text"
]);

const env = {
  APP_BACKEND_PROVIDER: "aws",
  NEXT_PUBLIC_APP_URL: appUrl,
  APP_WEB_URL: appUrl,
  COGNITO_REGION: ensureValue(outputMap, "CognitoRegion"),
  COGNITO_USER_POOL_ID: cognitoUserPoolId,
  COGNITO_APP_CLIENT_ID: cognitoAppClientId,
  COGNITO_APP_CLIENT_SECRET: cognitoAppClientSecret,
  COGNITO_DOMAIN: ensureValue(outputMap, "CognitoDomain"),
  COGNITO_CALLBACK_URL: ensureValue(outputMap, "CognitoCallbackUrl"),
  COGNITO_LOGOUT_URL: ensureValue(outputMap, "CognitoLogoutUrl"),
  APP_SESSION_SECRET: sessionSecret,
  AURORA_CLUSTER_ARN: ensureValue(outputMap, "AuroraClusterArn"),
  AURORA_SECRET_ARN: ensureValue(outputMap, "AuroraSecretArn"),
  AURORA_DATABASE: ensureValue(outputMap, "AuroraDatabase"),
  S3_BUCKET_NAME: ensureValue(outputMap, "S3BucketName"),
  S3_REGION: ensureValue(outputMap, "S3Region"),
  S3_PUBLIC_BASE_URL: ensureValue(outputMap, "S3PublicBaseUrl")
};

const googleIdpName = String(outputMap.CognitoGoogleIdpName ?? "").trim();
if (googleIdpName) {
  env.COGNITO_GOOGLE_IDP_NAME = googleIdpName;
}

const lines = Object.entries(env)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, value]) => `${key}=${quoteEnvValue(value)}`);

const rendered = `${lines.join("\n")}\n`;
const outputPath = outputPathArg ? path.resolve(process.cwd(), outputPathArg) : "";

if (outputPath) {
  fs.writeFileSync(outputPath, rendered, "utf8");
  console.log(`Wrote Amplify-ready env file to ${outputPath}`);
} else {
  process.stdout.write(rendered);
}
