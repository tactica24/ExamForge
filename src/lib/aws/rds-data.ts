import "server-only";

import { getAwsBackendConfig } from "@/lib/aws/config";
import { signedAwsFetch } from "@/lib/aws/signature-v4";

type AuroraTypeHint = "JSON" | "UUID" | "TIMESTAMP" | "DATE" | "TIME" | "DECIMAL";

export type AuroraSqlParameter = {
  name: string;
  value: unknown;
  typeHint?: AuroraTypeHint;
};

type AuroraField = {
  arrayValue?: {
    arrayValues?: AuroraField[];
    booleanValues?: boolean[];
    doubleValues?: number[];
    longValues?: number[];
    stringValues?: string[];
  };
  blobValue?: string;
  booleanValue?: boolean;
  doubleValue?: number;
  isNull?: boolean;
  longValue?: number;
  stringValue?: string;
};

type AuroraExecuteResponse = {
  formattedRecords?: string;
  generatedFields?: AuroraField[];
  numberOfRecordsUpdated?: number;
  records?: AuroraField[][];
};

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function getAuroraRegion(clusterArn: string | null) {
  const parts = String(clusterArn ?? "").split(":");
  return cleanText(parts[3]);
}

function encodeAuroraValue(value: unknown, typeHint?: AuroraTypeHint) {
  if (value == null) {
    return {
      value: { isNull: true }
    };
  }

  if (typeHint === "JSON") {
    return {
      typeHint,
      value: {
        stringValue: JSON.stringify(value)
      }
    };
  }

  if (typeof value === "boolean") {
    return {
      value: { booleanValue: value }
    };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) {
      return {
        value: { longValue: value }
      };
    }

    return {
      value: { doubleValue: value }
    };
  }

  return {
    ...(typeHint ? { typeHint } : {}),
    value: {
      stringValue: String(value)
    }
  };
}

function decodeAuroraField(field: AuroraField | undefined): unknown {
  if (!field) return null;
  if (field.isNull) return null;
  if ("booleanValue" in field) return field.booleanValue ?? null;
  if ("longValue" in field) return field.longValue ?? null;
  if ("doubleValue" in field) return field.doubleValue ?? null;
  if ("stringValue" in field) return field.stringValue ?? null;
  if ("blobValue" in field) return field.blobValue ?? null;

  if (field.arrayValue) {
    const { arrayValues, booleanValues, doubleValues, longValues, stringValues } = field.arrayValue;
    if (Array.isArray(arrayValues)) return arrayValues.map((value) => decodeAuroraField(value));
    if (Array.isArray(booleanValues)) return booleanValues;
    if (Array.isArray(doubleValues)) return doubleValues;
    if (Array.isArray(longValues)) return longValues;
    if (Array.isArray(stringValues)) return stringValues;
  }

  return null;
}

function parseAuroraRows(payload: AuroraExecuteResponse): Record<string, unknown>[] {
  if (payload.formattedRecords) {
    try {
      const parsed = JSON.parse(payload.formattedRecords) as unknown;
      return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
    } catch {
      return [];
    }
  }

  if (!Array.isArray(payload.records)) {
    return [];
  }

  return payload.records.map((row, index) => ({
    [`col_${index}`]: row.map((field) => decodeAuroraField(field))
  }));
}

function extractAuroraErrorMessage(status: number, rawText: string, payload: unknown) {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const message = cleanText(record.message) ?? cleanText(record.Message) ?? cleanText(record.error);
    if (message) return message;
  }

  return cleanText(rawText) ?? `Aurora Data API request failed with status ${status}.`;
}

export function isAuroraDataConfigured() {
  const cfg = getAwsBackendConfig();
  return Boolean(cfg.auroraClusterArn && cfg.auroraSecretArn && cfg.auroraDatabase && getAuroraRegion(cfg.auroraClusterArn));
}

export async function executeAuroraStatement(args: {
  sql: string;
  parameters?: AuroraSqlParameter[];
  continueAfterTimeout?: boolean;
  formatRecordsAsJson?: boolean;
}) {
  const cfg = getAwsBackendConfig();
  const region = getAuroraRegion(cfg.auroraClusterArn);

  if (!cfg.auroraClusterArn || !cfg.auroraSecretArn || !cfg.auroraDatabase || !region) {
    throw new Error("Aurora Data API is not configured.");
  }

  const body = {
    resourceArn: cfg.auroraClusterArn,
    secretArn: cfg.auroraSecretArn,
    database: cfg.auroraDatabase,
    sql: args.sql,
    continueAfterTimeout: args.continueAfterTimeout ?? true,
    ...(args.formatRecordsAsJson === false ? {} : { formatRecordsAs: "JSON" }),
    ...(args.parameters?.length
      ? {
          parameters: args.parameters.map((parameter) => ({
            name: parameter.name,
            ...encodeAuroraValue(parameter.value, parameter.typeHint)
          }))
        }
      : {})
  };

  const res = await signedAwsFetch({
    method: "POST",
    region,
    service: "rds-data",
    url: `https://rds-data.${region}.amazonaws.com/Execute`,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const rawText = await res.text().catch(() => "");
  const payload = rawText ? ((JSON.parse(rawText) as AuroraExecuteResponse | Record<string, unknown>)) : {};

  if (!res.ok) {
    throw new Error(extractAuroraErrorMessage(res.status, rawText, payload));
  }

  const data = payload as AuroraExecuteResponse;
  return {
    rows: parseAuroraRows(data),
    numberOfRecordsUpdated: Number(data.numberOfRecordsUpdated ?? 0),
    generatedFields: Array.isArray(data.generatedFields) ? data.generatedFields : [],
    raw: data
  };
}
