#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return String(process.argv[index + 1] ?? fallback).trim();
}

function splitSqlStatements(source) {
  const statements = [];
  let current = "";
  let inSingleQuote = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1] ?? "";

    if (char === "'" && source[i - 1] !== "\\") {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    if (!inSingleQuote && char === "-" && next === "-") {
      while (i < source.length && source[i] !== "\n") {
        i += 1;
      }
      current += "\n";
      continue;
    }

    if (!inSingleQuote && char === ";") {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

function runAws(args) {
  return execFileSync("aws", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

const region = getArg("--region");
const clusterArn = getArg("--cluster-arn", process.env.AURORA_CLUSTER_ARN ?? "");
const secretArn = getArg("--secret-arn", process.env.AURORA_SECRET_ARN ?? "");
const database = getArg("--database", process.env.AURORA_DATABASE ?? "");
const fileArg = getArg("--file", "infra/aws/aurora/schema.sql");
const sqlPath = path.resolve(process.cwd(), fileArg);

if (!region || !clusterArn || !secretArn || !database) {
  console.error(
    "Usage: node scripts/aws-apply-schema.mjs --region <aws-region> --cluster-arn <arn> --secret-arn <arn> --database <name> [--file infra/aws/aurora/schema.sql]"
  );
  process.exit(1);
}

if (!fs.existsSync(sqlPath)) {
  console.error(`Schema file not found: ${sqlPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");
const statements = splitSqlStatements(sql);

if (!statements.length) {
  console.error("No SQL statements found.");
  process.exit(1);
}

for (const [index, statement] of statements.entries()) {
  console.log(`Applying statement ${index + 1}/${statements.length}`);
  runAws([
    "rds-data",
    "execute-statement",
    "--region",
    region,
    "--resource-arn",
    clusterArn,
    "--secret-arn",
    secretArn,
    "--database",
    database,
    "--sql",
    statement
  ]);
}

console.log(`Applied ${statements.length} statements from ${sqlPath}`);
