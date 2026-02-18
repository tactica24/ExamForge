import "server-only";

import { randomUUID } from "crypto";
import type { Firestore } from "firebase-admin/firestore";

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
  profiles: ["user_id"],
  profile_public: ["user_id"],
  notification_prefs: ["user_id"],
  user_gamification: ["user_id"],
  referral_codes: ["user_id"],
  parent_links: ["token"],
  group_members: ["group_id", "user_id"],
  user_exam_subjects: ["user_id", "exam_id", "subject"],
  subscriptions: ["user_id", "provider", "tier"],
  leaderboard_entries: ["user_id", "period"]
};

const HAS_ID_FIELD = new Set([
  "exams",
  "syllabi",
  "user_exam_subjects",
  "user_plans",
  "plan_items",
  "groups",
  "group_messages",
  "quizzes",
  "quiz_questions",
  "user_quiz_results",
  "notifications",
  "subscriptions",
  "badges",
  "user_xp_events",
  "leaderboard_entries",
  "success_stories",
  "referrals"
]);

const HAS_UPDATED_AT = new Set([
  "profiles",
  "profile_public",
  "plan_items",
  "notification_prefs",
  "subscriptions",
  "user_gamification"
]);

type InternalRow = Record<string, any> & { __docId: string };

function asError(error: unknown): DbError {
  return { message: error instanceof Error ? error.message : "firebase_query_failed" };
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
  return splitSelectColumns(content).map((p) => p.trim()).filter(Boolean);
}

async function loadRows(db: Firestore | null, table: string): Promise<InternalRow[]> {
  if (!db) throw new Error("Firebase Firestore is not configured.");

  const snapshot = await db.collection(table).get();
  return snapshot.docs.map((doc: any) => {
    const data = doc.data() as Record<string, any>;
    return {
      __docId: doc.id,
      ...(HAS_ID_FIELD.has(table) ? { id: data.id ?? doc.id } : {}),
      ...data
    };
  });
}

async function attachGroupJoin(db: Firestore | null, rows: InternalRow[]): Promise<InternalRow[]> {
  if (!rows.length) return rows;
  if (!db) throw new Error("Firebase Firestore is not configured.");

  const ids = Array.from(new Set(rows.map((row) => row.group_id).filter(Boolean)));
  if (!ids.length) return rows;

  const snapshots = await Promise.all(ids.map((id) => db.collection("groups").doc(String(id)).get()));
  const groupsById = new Map<string, Record<string, any>>();

  snapshots.forEach((snap: any) => {
    if (!snap.exists) return;
    const data = snap.data() as Record<string, any>;
    groupsById.set(snap.id, { id: data.id ?? snap.id, ...data });
  });

  return rows.map((row) => ({
    ...row,
    groups: groupsById.get(String(row.group_id)) ?? null
  }));
}

async function resolveDocIdByConflict(
  db: Firestore | null,
  table: string,
  row: Record<string, any>,
  conflictFields: string[]
): Promise<string | null> {
  const rows = await loadRows(db, table);
  const found = rows.find((candidate) => conflictFields.every((field) => candidate[field] === row[field]));
  return found ? found.__docId : null;
}

function buildRowForWrite(table: string, row: Record<string, any>, docId: string) {
  const now = new Date().toISOString();
  const next = stripUndefinedValues({ ...row });

  if (HAS_ID_FIELD.has(table) && !next.id) next.id = docId;
  if (table === "parent_links" && !next.token) next.token = docId;
  if (next.created_at == null) next.created_at = now;
  if (HAS_UPDATED_AT.has(table)) next.updated_at = now;

  return next;
}

class SelectQuery implements PromiseLike<DbResponse<any[]>> {
  private readonly filters: FilterSpec[] = [];
  private readonly orders: OrderSpec[] = [];
  private limitValue: number | null = null;
  private columns = "*";
  private options: SelectOptions = {};

  constructor(
    private readonly db: Firestore | null,
    private readonly table: string
  ) {}

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
    this.limitValue = value;
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
      const needsGroupJoin =
        this.table === "group_members" &&
        (this.columns.includes("groups(") || this.columns.includes("groups!inner") || this.filters.some((f) => f.field.startsWith("groups.")));

      let rows = await loadRows(this.db, this.table);
      if (needsGroupJoin) {
        rows = await attachGroupJoin(this.db, rows);
      }

      rows = rows.filter((row) => this.filters.every((filter) => matchesFilter(row, filter)));

      const count = this.options.count === "exact" ? rows.length : undefined;

      for (const spec of this.orders) {
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

      if (this.limitValue != null) {
        rows = rows.slice(0, this.limitValue);
      }

      if (this.options.head) {
        return { data: null, error: null, count: count ?? rows.length };
      }

      const projected = this.project(rows);
      return { data: projected, error: null, count };
    } catch (error) {
      return { data: null, error: asError(error), count: null };
    }
  }

  private project(rows: InternalRow[]): any[] {
    if (this.columns.trim() === "*" || this.columns.trim() === "") {
      return rows.map(({ __docId, ...rest }) => rest);
    }

    const tokens = splitSelectColumns(this.columns);
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
}

class InsertQuery implements PromiseLike<DbResponse<any[]>> {
  private columns = "*";

  constructor(
    private readonly db: Firestore | null,
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
      if (!this.db) throw new Error("Firebase Firestore is not configured.");

      const conflictFields = this.upsertOptions?.onConflict
        ? this.upsertOptions.onConflict.split(",").map((field) => field.trim()).filter(Boolean)
        : PRIMARY_KEYS[this.table] ?? [];

      const rows: Record<string, any>[] = [];

      for (const row of this.values) {
        let docId = row.id ? String(row.id) : null;

        if (!docId && conflictFields.length) {
          const foundId = await resolveDocIdByConflict(this.db, this.table, row, conflictFields);
          if (foundId) {
            if (this.mode === "insert") {
              if (this.upsertOptions?.ignoreDuplicates) continue;
              throw new Error(`Duplicate row for ${this.table}`);
            }
            docId = foundId;
          }
        }

        if (!docId && (PRIMARY_KEYS[this.table] ?? []).length) {
          const keys = PRIMARY_KEYS[this.table] ?? [];
          const hasAll = keys.every((key) => row[key] != null);
          if (hasAll) {
            docId = makeCompositeId(keys.map((key) => row[key]));
          }
        }

        if (!docId) docId = randomUUID();

        const next = buildRowForWrite(this.table, row, docId);
        await this.db.collection(this.table).doc(docId).set(next, { merge: this.mode === "upsert" });
        rows.push(next);
      }

      if (this.columns === "*" || this.columns.trim() === "") {
        return { data: rows, error: null };
      }

      const fields = splitSelectColumns(this.columns);
      const projected = rows.map((row) => {
        const out: Record<string, any> = {};
        for (const field of fields) out[field] = row[field];
        return out;
      });

      return { data: projected, error: null };
    } catch (error) {
      return { data: null, error: asError(error) };
    }
  }
}

class UpdateQuery implements PromiseLike<DbResponse<any[]>> {
  private readonly filters: FilterSpec[] = [];

  constructor(
    private readonly db: Firestore | null,
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
      if (!this.db) throw new Error("Firebase Firestore is not configured.");

      const rows = await loadRows(this.db, this.table);
      const matched = rows.filter((row) => this.filters.every((filter) => matchesFilter(row, filter)));

      const now = new Date().toISOString();
      const payload = stripUndefinedValues({
        ...this.values,
        ...(HAS_UPDATED_AT.has(this.table) ? { updated_at: now } : {})
      });

      await Promise.all(matched.map((row) => this.db!.collection(this.table).doc(row.__docId).set(payload, { merge: true })));

      const updated = matched.map((row) => ({ ...row, ...payload }));
      return { data: updated, error: null };
    } catch (error) {
      return { data: null, error: asError(error) };
    }
  }
}

class DeleteQuery implements PromiseLike<DbResponse<{ count: number }>> {
  private readonly filters: FilterSpec[] = [];

  constructor(
    private readonly db: Firestore | null,
    private readonly table: string
  ) {}

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
      if (!this.db) throw new Error("Firebase Firestore is not configured.");

      const rows = await loadRows(this.db, this.table);
      const matched = rows.filter((row) => this.filters.every((filter) => matchesFilter(row, filter)));

      await Promise.all(matched.map((row) => this.db!.collection(this.table).doc(row.__docId).delete()));

      return { data: { count: matched.length }, error: null, count: matched.length };
    } catch (error) {
      return { data: null, error: asError(error), count: null };
    }
  }
}

export type FirebaseDataClient = {
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

export function createFirebaseDataClient(db: Firestore | null): FirebaseDataClient {
  return {
    from(table: string) {
      return {
        select(columns = "*", options?: SelectOptions) {
          return new SelectQuery(db, table).select(columns, options);
        },
        insert(values: Record<string, any> | Record<string, any>[]) {
          const rows = Array.isArray(values) ? values : [values];
          return new InsertQuery(db, table, rows, "insert");
        },
        upsert(values: Record<string, any> | Record<string, any>[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
          const rows = Array.isArray(values) ? values : [values];
          return new InsertQuery(db, table, rows, "upsert", options);
        },
        update(values: Record<string, any>) {
          return new UpdateQuery(db, table, values);
        },
        delete() {
          return new DeleteQuery(db, table);
        }
      };
    }
  };
}
