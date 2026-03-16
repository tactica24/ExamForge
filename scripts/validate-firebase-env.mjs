function readValue(key) {
  const value = process.env[key];
  if (value == null) return "";
  return String(value).trim();
}

function requireAny(keys, errors, label) {
  const found = keys.find((key) => readValue(key));
  if (!found) {
    errors.push(`- ${label}`);
  }
}

function parseServiceAccountJson(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.project_id || !parsed?.client_email || !parsed?.private_key) {
      return { ok: false, reason: "missing project_id, client_email, or private_key" };
    }
    return { ok: true, parsed };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "invalid JSON" };
  }
}

const errors = [];

requireAny(["NEXT_PUBLIC_FIREBASE_API_KEY"], errors, "NEXT_PUBLIC_FIREBASE_API_KEY");
requireAny(["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"], errors, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
requireAny(["NEXT_PUBLIC_FIREBASE_PROJECT_ID"], errors, "NEXT_PUBLIC_FIREBASE_PROJECT_ID");
requireAny(["NEXT_PUBLIC_APP_URL", "APP_WEB_URL"], errors, "NEXT_PUBLIC_APP_URL or APP_WEB_URL");

const base64 = readValue("FIREBASE_SERVICE_ACCOUNT_JSON_BASE64");
const json = readValue("FIREBASE_SERVICE_ACCOUNT_JSON");
const projectId = readValue("FIREBASE_PROJECT_ID");
const clientEmail = readValue("FIREBASE_CLIENT_EMAIL");
const privateKey = readValue("FIREBASE_PRIVATE_KEY");

if (base64) {
  const decoded = Buffer.from(base64, "base64").toString("utf8");
  const parsed = parseServiceAccountJson(decoded);
  if (!parsed.ok) {
    errors.push(`- FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 is invalid: ${parsed.reason}`);
  }
} else if (json) {
  const parsed = parseServiceAccountJson(json);
  if (!parsed.ok) {
    errors.push(`- FIREBASE_SERVICE_ACCOUNT_JSON is invalid: ${parsed.reason}`);
  }
} else if (!projectId || !clientEmail || !privateKey) {
  errors.push(
    "- Firebase admin credentials: set FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 or FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY"
  );
}

if (errors.length) {
  console.error("Missing or invalid Firebase deployment variables:");
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}

console.log("Firebase environment looks valid for Amplify.");
