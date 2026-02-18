import fs from "node:fs";
import process from "node:process";

const provided = (process.argv[2] || process.env.APP_WEB_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();

if (!provided) {
  console.error("Missing app URL. Usage: node scripts/mobile-set-app-url.mjs https://your-domain");
  process.exit(1);
}

if (!provided.startsWith("https://")) {
  console.error("App URL must start with https://");
  process.exit(1);
}

const file = "capacitor.config.json";
const json = JSON.parse(fs.readFileSync(file, "utf8"));
json.server = { url: provided, cleartext: false };
fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);

console.log(`Updated ${file} server.url -> ${provided}`);
