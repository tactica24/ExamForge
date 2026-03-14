import "server-only";

import { randomUUID } from "crypto";
import { executeAuroraStatement, isAuroraDataConfigured, type AuroraSqlParameter } from "@/lib/aws/rds-data";

type FilterKind = "eq" | "in" | "gte" | "lte";
type OrderSpec = { field: string; ascending: boolean };
type SelectOptions = { head?: boolean; count?: "exact" | null };

type FilterSpec = {
  kind: FilterKind;
  field: string;
  value: unknown;
};

export type DbError = { message: string };

export type DbResponse<T> = {
  data: T | null;
  error: DbError | null;
  count?: number | null;
};

const PRIMARY_KEYS: Record<string, string[]> = {
  ai_jobs: ["id"],
  app_settings: ["id"],
  auth_sessions: ["id"],
  badges: ["id"],
  billing_events: ["id"],
  contact_requests: ["id"],
  exams: ["id"],
  group_members: ["group_id", "user_id"],
  group_messages: ["id"],
  groups: ["id"],
  leaderboard_entries: ["user_id", "period"],
  notification_prefs: ["user_id"],
  notifications: ["id"],
  parent_links: ["token"],
  plan_items: ["id"],
  profile_public: ["user_id"],
  profiles: ["user_id"],
  quizzes: ["id"],
  quiz_questions: ["id"],
  rate_limits: ["key"],
  referral_codes: ["user_id"],
  referrals: ["id"],
  study_assets_cache: ["cache_key"],
  subscriptions: ["user_id", "provider"],
  success_stories: ["id"],
  syllabi: ["id"],
  tutor_messages: ["id"],
  tutor_threads: ["id"],
  user_exam_subjects: ["user_id", "exam_id", "subject"],
  user_gamification: ["user_id"],
  user_plans: ["id"],
  user_quiz_results: ["id"],
  user_xp_events: ["id"]
};

const HAS_ID_FIELD = new Set([
  "ai_jobs",
  "app_settings",
  "auth_sessions",
  "badges",
  "billing_events",
  "contact_requests",
  "exams",
  "group_messages",
  "groups",
  "leaderboard_entries",
  "notifications",
  "plan_items",
  "quizzes",
  "quiz_questions",
  "referrals",
  "subscriptions",
  "success_stories",
  "syllabi",
  "tutor_messages",
  "tutor_threads",
  "user_exam_subjects",
  "user_plans",
  "user_quiz_results",
  "user_xp_events"
]);

const HAS_CREATED_AT = new Set([
  "ai_jobs",
  "auth_sessions",
  "badges",
  "contact_requests",
  "exams",
  "group_messages",
  "groups",
  "notification_prefs",
  "notifications",
  "parent_links",
  "plan_items",
  "profile_public",
  "profiles",
  "quizzes",
  "referral_codes",
  "referrals",
  "study_assets_cache",
  "subscriptions",
  "success_stories",
  "syllabi",
  "tutor_messages",
  "tutor_threads",
  "user_exam_subjects",
  "user_gamification",
  "user_plans",
  "user_quiz_results",
  "user_xp_events"
]);

const HAS_UPDATED_AT = new Set([
  "app_settings",
  "notification_prefs",
  "plan_items",
  "profile_public",
  "profiles",
  "rate_limits",
  "study_assets_cache",
  "subscriptions",
  "tutor_threads",
  "user_gamification"
]);

const JSON_FIELDS = new Map<string, Set<string>>([
  ["ai_jobs", new Set(["payload", "result_meta"])],
  ["badges", new Set(["criteria"])],
  ["billing_events", new Set(["metadata"])],
  ["exams", new Set(["subjects", "syllabus_sources"])],
  ["notification_prefs", new Set(["channels", "reminders"])],
  ["notifications", new Set(["provider_meta"])],
  ["plan_items", new Set(["resource_links"])],
  ["profiles", new Set(["exam_interest_slugs"])],
  ["quizzes", new Set(["meta"])],
  ["quiz_questions", new Set(["options"])],
  ["study_assets_cache", new Set(["lesson", "assets"])],
  ["syllabi", new Set(["topics", "source_meta"])],
  ["user_gamification", new Set(["badges"])],
  ["user_plans", new Set(["weak_areas"])],
  ["user_quiz_results", new Set(["answers"])],
  ["user_xp_events", new Set(["meta"])]
]);

type InternalRow = Record<string, any> & { __memoryId?: string };

const ALLOW_IN_MEMORY_BACKEND_FALLBACK = process.env.ALLOW_BACKEND_IN_MEMORY_FALLBACK === "1";
const BACKEND_MEMORY_STORE_KEY = "__aceNaijaBackendMemoryStore";

function asError(error: unknown): DbError {
  return { message: error instanceof Error ? error.message : "backend_query_failed" };
}

function getByPath(obj: Record<string, any>, path: string): unknown {
  if (!path.includes(".")) return obj[path];
  const parts = path.split(".");
  let current: any = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function stripUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedValues(item))
      .filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const next = stripUndefinedValues(item);
      if (next !== undefined) output[key] = next;
    }
    return output as T;
  }

  return value;
}

function splitSelectColumns(input: string): string[] {
  const cols: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of input) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;

    if (char === "," && depth === 0) {
      const token = current.trim();
      if (token) cols.push(token);
      current = "";
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) cols.push(tail);
  return cols;
}

function normalizeComparable(value: unknown): string | number | boolean | null {
  if (value == null) return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function matchesFilter(row: Record<string, any>, filter: FilterSpec): boolean {
  const left = getByPath(row, filter.field);
  const right = filter.value;

  switch (filter.kind) {
    case "eq":
      return left === right;
    case "in":
      return Array.isArray(right) ? right.includes(left) : false;
    case "gte": {
      const a = normalizeComparable(left);
      const b = normalizeComparable(right);
      if (a == null || b == null) return false;
      return a >= b;
    }
    case "lte": {
      const a = normalizeComparable(left);
      const b = normalizeComparable(right);
      if (a == null || b == null) return false;
      return a <= b;
    }
    default:
      return false;
  }
}

function sanitizeForId(value: unknown): string {
  return String(value ?? "").replaceAll("/", "_").replaceAll(" ", "-");
}

function makeCompositeId(parts: unknown[]): string {
  return parts.map(sanitizeForId).join("__");
}

function parseJoinFields(token: string): string[] {
  const start = token.indexOf("(");
  const end = token.lastIndexOf(")");
  if (start < 0 || end <= start) return [];
  const content = token.slice(start + 1, end);
  return splitSelectColumns(content).map((part) => part.trim()).filter(Boolean);
}

function safeJsonParse(value: unknown) {
  if (typeof value !== "string") return value;
  const raw = value.trim();
  if (!raw) return value;
  try {
    return JSON.parse(raw);
  } catch {
    return value;
  }
}

function normalizeReturnedRow(table: string, value: Record<string, unknown>) {
  const next: Record<string, unknown> = { ...value };
  const jsonFields = JSON_FIELDS.get(table) ?? new Set<string>();

  for (const field of jsonFields) {
    if (field in next) {
      next[field] = safeJsonParse(next[field]);
    }
  }

  if ("groups" in next) {
    next.groups = safeJsonParse(next.groups);
  }

  return next;
}

function ensureIdentifier(value: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsupported identifier: ${value}`);
  }
  return value;
}

function quoteIdentifier(value: string) {
  return `"${ensureIdentifier(value)}"`;
}

function cleanLimit(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
}

function typeHintForColumn(table: string, column: string, value: unknown) {
  if (value == null) return undefined;
  return (JSON_FIELDS.get(table)?.has(column) ?? false) ? "JSON" : undefined;
}

function resolveWriteId(table: string, row: Record<string, any>) {
  if (row.id != null) return String(row.id);

  const keys = (PRIMARY_KEYS[table] ?? []).filter((key) => key !== "id");
  if (HAS_ID_FIELD.has(table) && keys.length && keys.every((key) => row[key] != null)) {
    return makeCompositeId(keys.map((key) => row[key]));
  }

  return randomUUID();
}

function buildRowForWrite(table: string, row: Record<string, any>, docId: string) {
  const now = new Date().toISOString();
  const next = stripUndefinedValues({ ...row });

  if (HAS_ID_FIELD.has(table) && !next.id) next.id = docId;
  if (table === "parent_links" && !next.token) next.token = docId;
  if (HAS_CREATED_AT.has(table) && next.created_at == null) next.created_at = now;
  if (HAS_UPDATED_AT.has(table) && next.updated_at == null) next.updated_at = now;

  return next;
}

function memoryStore() {
  const globalRef = globalThis as typeof globalThis & {
    [BACKEND_MEMORY_STORE_KEY]?: Map<string, InternalRow[]>;
  };

  if (!globalRef[BACKEND_MEMORY_STORE_KEY]) {
    globalRef[BACKEND_MEMORY_STORE_KEY] = new Map<string, InternalRow[]>();
  }

  return globalRef[BACKEND_MEMORY_STORE_KEY]!;
}

function readMemoryRows(table: string): InternalRow[] {
  return (memoryStore().get(table) ?? []).map((row) => ({ ...row }));
}

function writeMemoryRows(table: string, rows: InternalRow[]) {
  memoryStore().set(
    table,
    rows.map((row) => ({ ...row }))
  );
}

function stripInternalFields(row: InternalRow) {
  const { __memoryId, ...rest } = row;
  return rest;
}

function createSqlBuilder() {
  let index = 0;
  const parameters: AuroraSqlParameter[] = [];

  return {
    parameters,
    add(table: string, column: string, value: unknown) {
      const name = `p${index++}`;
      parameters.push({
        name,
        value,
        ...(typeHintForColumn(table, column, value) ? { typeHint: "JSON" as const } : {})
      });
      return `:${name}`;
    }
  };
}

function applyInMemoryFilters(rows: InternalRow[], filters: FilterSpec[]) {
  if (!filters.length) return rows;
  return rows.filter((row) => filters.every((filter) => matchesFilter(row, filter)));
}

function applyInMemoryOrder(rows: InternalRow[], orders: OrderSpec[]) {
  if (!orders.length) return rows;
  for (const spec of orders) {
    rows.sort((a, b) => {
      const left = normalizeComparable(getByPath(a, spec.field));
      const right = normalizeComparable(getByPath(b, spec.field));
      if (left == null && right == null) return 0;
      if (left == null) return spec.ascending ? -1 : 1;
      if (right == null) return spec.ascending ? 1 : -1;
      if (left === right) return 0;
      if (left > right) return spec.ascending ? 1 : -1;
      return spec.ascending ? -1 : 1;
    });
  }
  return rows;
}

function applyInMemoryLimit(rows: InternalRow[], limitValue: number | null) {
  if (limitValue == null) return rows;
  return rows.slice(0, limitValue);
}

function attachGroupJoinFromMemory(rows: InternalRow[]): InternalRow[] {
  if (!rows.length) return rows;
  const groups = new Map(
    readMemoryRows("groups")
      .map((row) => [String(row.id ?? ""), stripInternalFields(row)] as const)
      .filter(([id]) => id)
  );

  return rows.map((row) => ({
    ...row,
    groups: groups.get(String(row.group_id ?? "")) ?? null
  }));
}

function projectRows(columns: string, rows: InternalRow[]): any[] {
  if (columns.trim() === "*" || columns.trim() === "") {
    return rows.map((row) => stripInternalFields(row));
  }

  const tokens = splitSelectColumns(columns);
  const plainFields = tokens.filter((token) => !token.startsWith("groups"));
  const groupInner = tokens.find((token) => token.startsWith("groups!inner("));
  const groupAll = tokens.includes("groups(*)");
  const groupFields = groupInner ? parseJoinFields(groupInner) : [];

  return rows
    .filter((row) => {
      if (!groupInner) return true;
      return Boolean(row.groups);
    })
    .map((row) => {
      const out: Record<string, any> = {};
      for (const field of plainFields) {
        out[field] = getByPath(row, field);
      }

      if (groupAll) {
        out.groups = row.groups;
      } else if (groupInner) {
        out.groups = groupFields.reduce((acc, field) => {
          acc[field] = row.groups?.[field];
          return acc;
        }, {} as Record<string, any>);
      }

      return out;
    });
}

function fieldReference(field: string, allowGroupJoin: boolean) {
  if (field.startsWith("groups.")) {
    if (!allowGroupJoin) {
      throw new Error(`Unsupported joined field outside group_members select: ${field}`);
    }
    return `g.${quoteIdentifier(field.slice("groups.".length))}`;
  }

  return `t.${quoteIdentifier(field)}`;
}

function buildWhereClause(args: {
  table: string;
  filters: FilterSpec[];
  builder: ReturnType<typeof createSqlBuilder>;
  allowGroupJoin: boolean;
}) {
  if (!args.filters.length) return "";

  const clauses = args.filters.map((filter) => {
    const ref = fieldReference(filter.field, args.allowGroupJoin);
    const column = filter.field.split(".").pop() ?? filter.field;

    if (filter.kind === "eq") {
      if (filter.value == null) return `${ref} IS NULL`;
      return `${ref} = ${args.builder.add(args.table, column, filter.value)}`;
    }

    if (filter.kind === "in") {
      const values = Array.isArray(filter.value) ? filter.value : [];
      if (!values.length) return "1 = 0";

      const nonNull = values.filter((value) => value != null);
      const parts: string[] = [];

      if (nonNull.length) {
        const placeholders = nonNull.map((value) => args.builder.add(args.table, column, value));
        parts.push(`${ref} IN (${placeholders.join(", ")})`);
      }

      if (values.length !== nonNull.length) {
        parts.push(`${ref} IS NULL`);
      }

      return parts.length === 1 ? parts[0] : `(${parts.join(" OR ")})`;
    }

    if (filter.kind === "gte") {
      return `${ref} >= ${args.builder.add(args.table, column, filter.value)}`;
    }

    if (filter.kind === "lte") {
      return `${ref} <= ${args.builder.add(args.table, column, filter.value)}`;
    }

    return "1 = 1";
  });

  return ` WHERE ${clauses.join(" AND ")}`;
}

function buildOrderClause(orders: OrderSpec[], allowGroupJoin: boolean) {
  if (!orders.length) return "";
  return ` ORDER BY ${orders
    .map((order) => `${fieldReference(order.field, allowGroupJoin)} ${order.ascending ? "ASC" : "DESC"}`)
    .join(", ")}`;
}

function buildSelectList(table: string, columns: string, allowGroupJoin: boolean) {
  if (columns.trim() === "*" || columns.trim() === "") {
    return "t.*";
  }

  const tokens = splitSelectColumns(columns);
  const selections: string[] = [];

  for (const token of tokens) {
    if (!token) continue;
    if (token === "*") {
      selections.push("t.*");
      continue;
    }

    if (token === "groups(*)") {
      if (!allowGroupJoin) throw new Error("groups(*) is only supported on group_members queries.");
      selections.push(`CASE WHEN g."id" IS NULL THEN NULL ELSE to_jsonb(g) END AS "groups"`);
      continue;
    }

    if (token.startsWith("groups!inner(")) {
      if (!allowGroupJoin) throw new Error("groups!inner(...) is only supported on group_members queries.");
      const fields = parseJoinFields(token);
      const entries = fields.map((field) => `'${ensureIdentifier(field)}', g.${quoteIdentifier(field)}`).join(", ");
      selections.push(`jsonb_build_object(${entries}) AS "groups"`);
      continue;
    }

    selections.push(`${fieldReference(token, allowGroupJoin)} AS ${quoteIdentifier(token)}`);
  }

  return selections.length ? selections.join(", ") : "t.*";
}

function buildSelectPlan(args: {
  table: string;
  columns: string;
  filters: FilterSpec[];
  orders: OrderSpec[];
  limit: number | null;
  countOnly?: boolean;
}) {
  const builder = createSqlBuilder();
  const usesGroupJoin =
    args.table === "group_members" &&
    (args.columns.includes("groups(") ||
      args.columns.includes("groups!inner") ||
      args.filters.some((filter) => filter.field.startsWith("groups.")) ||
      args.orders.some((order) => order.field.startsWith("groups.")));
  const joinType =
    usesGroupJoin && (args.columns.includes("groups!inner(") || args.filters.some((filter) => filter.field.startsWith("groups.")))
      ? "INNER JOIN"
      : "LEFT JOIN";
  const fromClause = ` FROM ${quoteIdentifier(args.table)} AS t${
    usesGroupJoin ? ` ${joinType} "groups" AS g ON g."id" = t."group_id"` : ""
  }`;
  const whereClause = buildWhereClause({
    table: args.table,
    filters: args.filters,
    builder,
    allowGroupJoin: usesGroupJoin
  });
  const orderClause = args.countOnly ? "" : buildOrderClause(args.orders, usesGroupJoin);
  const limitValue = cleanLimit(args.limit);
  const limitClause = args.countOnly || limitValue == null ? "" : ` LIMIT ${limitValue}`;
  const selectList = args.countOnly ? `COUNT(*)::int AS "count"` : buildSelectList(args.table, args.columns, usesGroupJoin);

  return {
    sql: `SELECT ${selectList}${fromClause}${whereClause}${orderClause}${limitClause}`,
    parameters: builder.parameters
  };
}

async function selectRowsFromAurora(args: {
  table: string;
  columns: string;
  filters: FilterSpec[];
  orders: OrderSpec[];
  limit: number | null;
}) {
  const plan = buildSelectPlan(args);
  const result = await executeAuroraStatement({
    sql: plan.sql,
    parameters: plan.parameters
  });

  return result.rows.map((row) => normalizeReturnedRow(args.table, row));
}

async function countRowsFromAurora(table: string, filters: FilterSpec[]) {
  const plan = buildSelectPlan({
    table,
    columns: "id",
    filters,
    orders: [],
    limit: null,
    countOnly: true
  });
  const result = await executeAuroraStatement({
    sql: plan.sql,
    parameters: plan.parameters
  });

  return Number((result.rows[0] as Record<string, unknown> | undefined)?.count ?? 0);
}

function upsertAssignment(table: string, column: string) {
  const col = quoteIdentifier(column);
  const tableSql = quoteIdentifier(table);

  if (column === "id" && HAS_ID_FIELD.has(table)) {
    return `${col} = ${tableSql}.${col}`;
  }

  if (column === "created_at" && HAS_CREATED_AT.has(table)) {
    return `${col} = ${tableSql}.${col}`;
  }

  return `${col} = EXCLUDED.${col}`;
}

async function insertRowsIntoAurora(args: {
  table: string;
  values: Record<string, any>[];
  mode: "insert" | "upsert";
  upsertOptions?: { onConflict?: string; ignoreDuplicates?: boolean };
}) {
  const preparedRows = args.values.map((row) => buildRowForWrite(args.table, row, resolveWriteId(args.table, row)));
  const grouped = new Map<string, { columns: string[]; rows: Record<string, any>[] }>();

  for (const row of preparedRows) {
    const columns = Object.keys(row).sort((a, b) => a.localeCompare(b));
    const signature = columns.join("|");
    const group = grouped.get(signature);
    if (group) {
      group.rows.push(row);
    } else {
      grouped.set(signature, {
        columns,
        rows: [row]
      });
    }
  }

  const conflictFields = (args.upsertOptions?.onConflict
    ? args.upsertOptions.onConflict.split(",")
    : PRIMARY_KEYS[args.table] ?? []
  )
    .map((field) => field.trim())
    .filter(Boolean);

  const out: Record<string, unknown>[] = [];

  for (const group of grouped.values()) {
    if (!group.columns.length) continue;

    const builder = createSqlBuilder();
    const quotedColumns = group.columns.map((column) => quoteIdentifier(column)).join(", ");
    const valuesSql = group.rows
      .map((row) => {
        const placeholders = group.columns.map((column) => builder.add(args.table, column, row[column]));
        return `(${placeholders.join(", ")})`;
      })
      .join(", ");

    let sql = `INSERT INTO ${quoteIdentifier(args.table)} (${quotedColumns}) VALUES ${valuesSql}`;

    if (args.mode === "upsert" && conflictFields.length) {
      sql += ` ON CONFLICT (${conflictFields.map((field) => quoteIdentifier(field)).join(", ")}) DO UPDATE SET ${group.columns
        .map((column) => upsertAssignment(args.table, column))
        .join(", ")}`;
    } else if (args.mode === "insert" && args.upsertOptions?.ignoreDuplicates && conflictFields.length) {
      sql += ` ON CONFLICT (${conflictFields.map((field) => quoteIdentifier(field)).join(", ")}) DO NOTHING`;
    }

    sql += " RETURNING *";

    const result = await executeAuroraStatement({
      sql,
      parameters: builder.parameters
    });
    out.push(...result.rows.map((row) => normalizeReturnedRow(args.table, row)));
  }

  return out;
}

async function updateRowsInAurora(args: {
  table: string;
  values: Record<string, any>;
  filters: FilterSpec[];
}) {
  const payload = stripUndefinedValues({
    ...args.values,
    ...(HAS_UPDATED_AT.has(args.table) ? { updated_at: new Date().toISOString() } : {})
  }) as Record<string, any>;
  const columns = Object.keys(payload);
  if (!columns.length) return [];

  const builder = createSqlBuilder();
  const setClause = columns
    .map((column) => `${quoteIdentifier(column)} = ${builder.add(args.table, column, payload[column])}`)
    .join(", ");
  const whereClause = buildWhereClause({
    table: args.table,
    filters: args.filters,
    builder,
    allowGroupJoin: false
  });

  const result = await executeAuroraStatement({
    sql: `UPDATE ${quoteIdentifier(args.table)} AS t SET ${setClause}${whereClause} RETURNING *`,
    parameters: builder.parameters
  });

  return result.rows.map((row) => normalizeReturnedRow(args.table, row));
}

async function deleteRowsFromAurora(args: {
  table: string;
  filters: FilterSpec[];
}) {
  const builder = createSqlBuilder();
  const whereClause = buildWhereClause({
    table: args.table,
    filters: args.filters,
    builder,
    allowGroupJoin: false
  });
  const result = await executeAuroraStatement({
    sql: `DELETE FROM ${quoteIdentifier(args.table)} AS t${whereClause} RETURNING 1 AS "deleted"`,
    parameters: builder.parameters
  });
  return result.rows.length;
}

function countRowsFromMemory(table: string, filters: FilterSpec[]) {
  return applyInMemoryFilters(readMemoryRows(table), filters).length;
}

async function insertRowsIntoMemory(args: {
  table: string;
  values: Record<string, any>[];
  mode: "insert" | "upsert";
  upsertOptions?: { onConflict?: string; ignoreDuplicates?: boolean };
}) {
  const conflictFields = (args.upsertOptions?.onConflict
    ? args.upsertOptions.onConflict.split(",")
    : PRIMARY_KEYS[args.table] ?? []
  )
    .map((field) => field.trim())
    .filter(Boolean);
  const current = readMemoryRows(args.table);
  const out: Record<string, any>[] = [];

  for (const rawRow of args.values) {
    const built = buildRowForWrite(args.table, rawRow, resolveWriteId(args.table, rawRow));
    const foundIndex =
      conflictFields.length === 0
        ? -1
        : current.findIndex((candidate) => conflictFields.every((field) => candidate[field] === built[field]));

    if (foundIndex >= 0) {
      if (args.mode === "insert") {
        if (args.upsertOptions?.ignoreDuplicates) continue;
        throw new Error(`Duplicate row for ${args.table}`);
      }

      const existing = current[foundIndex];
      const next: InternalRow = {
        ...existing,
        ...built,
        __memoryId: existing.__memoryId ?? randomUUID()
      };

      if (HAS_ID_FIELD.has(args.table) && existing.id != null) next.id = existing.id;
      if (HAS_CREATED_AT.has(args.table) && existing.created_at != null) next.created_at = existing.created_at;

      current[foundIndex] = next;
      out.push(stripInternalFields(next));
      continue;
    }

    const next: InternalRow = {
      ...built,
      __memoryId: randomUUID()
    };
    current.push(next);
    out.push(stripInternalFields(next));
  }

  writeMemoryRows(args.table, current);
  return out;
}

async function updateRowsInMemory(args: {
  table: string;
  values: Record<string, any>;
  filters: FilterSpec[];
}) {
  const payload = stripUndefinedValues({
    ...args.values,
    ...(HAS_UPDATED_AT.has(args.table) ? { updated_at: new Date().toISOString() } : {})
  });
  const current = readMemoryRows(args.table);
  const updated: Record<string, any>[] = [];

  for (let index = 0; index < current.length; index += 1) {
    if (!args.filters.every((filter) => matchesFilter(current[index], filter))) continue;
    current[index] = {
      ...current[index],
      ...payload
    };
    updated.push(stripInternalFields(current[index]));
  }

  writeMemoryRows(args.table, current);
  return updated;
}

async function deleteRowsFromMemory(args: {
  table: string;
  filters: FilterSpec[];
}) {
  const current = readMemoryRows(args.table);
  const kept = current.filter((row) => !args.filters.every((filter) => matchesFilter(row, filter)));
  const deleted = current.length - kept.length;
  writeMemoryRows(args.table, kept);
  return deleted;
}

class SelectQuery implements PromiseLike<DbResponse<any[]>> {
  private readonly filters: FilterSpec[] = [];
  private readonly orders: OrderSpec[] = [];
  private limitValue: number | null = null;
  private columns = "*";
  private options: SelectOptions = {};

  constructor(private readonly table: string) {}

  select(columns = "*", options?: SelectOptions) {
    this.columns = columns;
    this.options = options ?? {};
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push({ kind: "eq", field, value });
    return this;
  }

  in(field: string, values: unknown[]) {
    this.filters.push({ kind: "in", field, value: values });
    return this;
  }

  gte(field: string, value: unknown) {
    this.filters.push({ kind: "gte", field, value });
    return this;
  }

  lte(field: string, value: unknown) {
    this.filters.push({ kind: "lte", field, value });
    return this;
  }

  order(field: string, args?: { ascending?: boolean }) {
    this.orders.push({ field, ascending: args?.ascending !== false });
    return this;
  }

  limit(value: number) {
    this.limitValue = cleanLimit(value);
    return this;
  }

  async maybeSingle(): Promise<DbResponse<any>> {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error, count: result.count };
    const rows = result.data ?? [];
    return { data: rows[0] ?? null, error: null, count: result.count };
  }

  async single(): Promise<DbResponse<any>> {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error, count: result.count };

    const rows = result.data ?? [];
    if (!rows.length) return { data: null, error: { message: "No rows returned" }, count: result.count };

    return { data: rows[0], error: null, count: result.count };
  }

  then<TResult1 = DbResponse<any[]>, TResult2 = never>(
    onfulfilled?: ((value: DbResponse<any[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  private async execute(): Promise<DbResponse<any[]>> {
    try {
      if (isAuroraDataConfigured()) {
        const count =
          this.options.count === "exact" ? await countRowsFromAurora(this.table, this.filters) : undefined;

        if (this.options.head) {
          return { data: null, error: null, count: count ?? 0 };
        }

        const rows = await selectRowsFromAurora({
          table: this.table,
          columns: this.columns,
          filters: this.filters,
          orders: this.orders,
          limit: this.limitValue
        });
        return { data: rows, error: null, count };
      }

      if (!ALLOW_IN_MEMORY_BACKEND_FALLBACK) {
        throw new Error("Aurora backend data store is not configured.");
      }

      const needsGroupJoin =
        this.table === "group_members" &&
        (this.columns.includes("groups(") ||
          this.columns.includes("groups!inner") ||
          this.filters.some((filter) => filter.field.startsWith("groups.")));

      if (needsGroupJoin) {
        const rowFilters = this.filters.filter((filter) => !filter.field.startsWith("groups."));
        const groupFilters = this.filters.filter((filter) => filter.field.startsWith("groups."));

        let rows = applyInMemoryFilters(readMemoryRows(this.table), rowFilters);
        rows = attachGroupJoinFromMemory(rows);
        rows = applyInMemoryFilters(rows, groupFilters);
        rows = applyInMemoryOrder(rows, this.orders);

        const count = this.options.count === "exact" ? rows.length : undefined;
        rows = applyInMemoryLimit(rows, this.limitValue);

        if (this.options.head) {
          return { data: null, error: null, count: count ?? rows.length };
        }

        return { data: projectRows(this.columns, rows), error: null, count };
      }

      let rows = readMemoryRows(this.table);
      const count = this.options.count === "exact" ? countRowsFromMemory(this.table, this.filters) : undefined;
      rows = applyInMemoryFilters(rows, this.filters);
      rows = applyInMemoryOrder(rows, this.orders);
      rows = applyInMemoryLimit(rows, this.limitValue);

      if (this.options.head) {
        return { data: null, error: null, count: count ?? rows.length };
      }

      return { data: projectRows(this.columns, rows), error: null, count };
    } catch (error) {
      return { data: null, error: asError(error), count: null };
    }
  }
}

class InsertQuery implements PromiseLike<DbResponse<any[]>> {
  private columns = "*";

  constructor(
    private readonly table: string,
    private readonly values: Record<string, any>[],
    private readonly mode: "insert" | "upsert",
    private readonly upsertOptions?: { onConflict?: string; ignoreDuplicates?: boolean }
  ) {}

  select(columns = "*") {
    this.columns = columns;
    return this;
  }

  async maybeSingle(): Promise<DbResponse<any>> {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error, count: result.count };
    const rows = result.data ?? [];
    return { data: rows[0] ?? null, error: null, count: result.count };
  }

  async single(): Promise<DbResponse<any>> {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error, count: result.count };
    const rows = result.data ?? [];
    if (!rows.length) return { data: null, error: { message: "No rows returned" }, count: result.count };
    return { data: rows[0], error: null, count: result.count };
  }

  then<TResult1 = DbResponse<any[]>, TResult2 = never>(
    onfulfilled?: ((value: DbResponse<any[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  private async execute(): Promise<DbResponse<any[]>> {
    try {
      const rows = isAuroraDataConfigured()
        ? await insertRowsIntoAurora({
            table: this.table,
            values: this.values,
            mode: this.mode,
            upsertOptions: this.upsertOptions
          })
        : ALLOW_IN_MEMORY_BACKEND_FALLBACK
          ? await insertRowsIntoMemory({
              table: this.table,
              values: this.values,
              mode: this.mode,
              upsertOptions: this.upsertOptions
            })
          : (() => {
              throw new Error("Aurora backend data store is not configured.");
            })();

      if (this.columns === "*" || this.columns.trim() === "") {
        return { data: rows, error: null };
      }

      return { data: projectRows(this.columns, rows as InternalRow[]), error: null };
    } catch (error) {
      return { data: null, error: asError(error) };
    }
  }
}

class UpdateQuery implements PromiseLike<DbResponse<any[]>> {
  private readonly filters: FilterSpec[] = [];

  constructor(
    private readonly table: string,
    private readonly values: Record<string, any>
  ) {}

  eq(field: string, value: unknown) {
    this.filters.push({ kind: "eq", field, value });
    return this;
  }

  in(field: string, values: unknown[]) {
    this.filters.push({ kind: "in", field, value: values });
    return this;
  }

  gte(field: string, value: unknown) {
    this.filters.push({ kind: "gte", field, value });
    return this;
  }

  lte(field: string, value: unknown) {
    this.filters.push({ kind: "lte", field, value });
    return this;
  }

  then<TResult1 = DbResponse<any[]>, TResult2 = never>(
    onfulfilled?: ((value: DbResponse<any[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  private async execute(): Promise<DbResponse<any[]>> {
    try {
      const rows = isAuroraDataConfigured()
        ? await updateRowsInAurora({
            table: this.table,
            values: this.values,
            filters: this.filters
          })
        : ALLOW_IN_MEMORY_BACKEND_FALLBACK
          ? await updateRowsInMemory({
              table: this.table,
              values: this.values,
              filters: this.filters
            })
          : (() => {
              throw new Error("Aurora backend data store is not configured.");
            })();

      return { data: rows, error: null };
    } catch (error) {
      return { data: null, error: asError(error) };
    }
  }
}

class DeleteQuery implements PromiseLike<DbResponse<{ count: number }>> {
  private readonly filters: FilterSpec[] = [];

  constructor(private readonly table: string) {}

  eq(field: string, value: unknown) {
    this.filters.push({ kind: "eq", field, value });
    return this;
  }

  in(field: string, values: unknown[]) {
    this.filters.push({ kind: "in", field, value: values });
    return this;
  }

  then<TResult1 = DbResponse<{ count: number }>, TResult2 = never>(
    onfulfilled?: ((value: DbResponse<{ count: number }>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }

  private async execute(): Promise<DbResponse<{ count: number }>> {
    try {
      const count = isAuroraDataConfigured()
        ? await deleteRowsFromAurora({
            table: this.table,
            filters: this.filters
          })
        : ALLOW_IN_MEMORY_BACKEND_FALLBACK
          ? await deleteRowsFromMemory({
              table: this.table,
              filters: this.filters
            })
          : (() => {
              throw new Error("Aurora backend data store is not configured.");
            })();

      return { data: { count }, error: null, count };
    } catch (error) {
      return { data: null, error: asError(error), count: null };
    }
  }
}

export type AppDataClient = {
  from: (table: string) => {
    select: (columns?: string, options?: SelectOptions) => SelectQuery;
    insert: (values: Record<string, any> | Record<string, any>[]) => InsertQuery;
    upsert: (
      values: Record<string, any> | Record<string, any>[],
      options?: { onConflict?: string; ignoreDuplicates?: boolean }
    ) => InsertQuery;
    update: (values: Record<string, any>) => UpdateQuery;
    delete: () => DeleteQuery;
  };
};

export function createAppDataClient(): AppDataClient {
  return {
    from(table: string) {
      return {
        select(columns = "*", options?: SelectOptions) {
          return new SelectQuery(table).select(columns, options);
        },
        insert(values: Record<string, any> | Record<string, any>[]) {
          const rows = Array.isArray(values) ? values : [values];
          return new InsertQuery(table, rows, "insert");
        },
        upsert(values: Record<string, any> | Record<string, any>[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
          const rows = Array.isArray(values) ? values : [values];
          return new InsertQuery(table, rows, "upsert", options);
        },
        update(values: Record<string, any>) {
          return new UpdateQuery(table, values);
        },
        delete() {
          return new DeleteQuery(table);
        }
      };
    }
  };
}
