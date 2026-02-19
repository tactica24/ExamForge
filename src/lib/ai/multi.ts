import "server-only";

import { getServerEnv } from "@/lib/env";
import { getOpenAIClient } from "@/lib/ai/openai";

type AiProvider = "openai" | "groq" | "gemini";

type ProviderRunArgs = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
};

type ProviderRunResult = {
  text: string | null;
  model: string | null;
  error: string | null;
};

export type AiTextResult = {
  text: string | null;
  provider: AiProvider | null;
  model: string | null;
  error: string | null;
};

export type AiJsonResult<T> = {
  value: T | null;
  rawText: string | null;
  provider: AiProvider | null;
  model: string | null;
  error: string | null;
};

const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1-nano"] as const;
const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"] as const;
const GEMINI_MODEL_PREFERENCES = [
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro-latest",
  "gemini-1.5-flash",
  "gemini-1.5-pro"
] as const;
const GEMINI_MODELS_FALLBACK = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-pro-latest",
  "gemini-1.5-pro"
] as const;
const GEMINI_MODELS_CACHE_TTL_MS = 10 * 60 * 1000;
const GEMINI_MODELS_CACHE_KEY = "__aceNaijaGeminiModelsCache";

type GeminiModelCache = {
  fetchedAt: number;
  models: string[];
};

function trimError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "unknown_error");
  return message.slice(0, 280);
}

function providerOrder() {
  const env = getServerEnv();
  const providers: AiProvider[] = [];
  if (env.OPENAI_API_KEY) providers.push("openai");
  if (env.GROQ_API_KEY) providers.push("groq");
  if (env.GEMINI_API_KEY) providers.push("gemini");
  return providers;
}

function parseJsonObject(text: string): any | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function normalizeGeminiModelName(name: unknown) {
  const raw = String(name ?? "").trim();
  if (!raw) return "";
  return raw.startsWith("models/") ? raw.slice("models/".length) : raw;
}

function isTextGeminiModel(modelName: string) {
  const name = modelName.toLowerCase();
  if (!name.startsWith("gemini")) return false;

  const blockedTags = ["embedding", "image", "vision", "tts", "transcribe", "audio"];
  return !blockedTags.some((tag) => name.includes(tag));
}

function extractGeminiText(payload: unknown) {
  const root = (payload ?? {}) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: unknown }>;
      };
    }>;
  };

  const first = Array.isArray(root.candidates) ? root.candidates[0] : undefined;
  const parts = Array.isArray(first?.content?.parts) ? first.content.parts : [];

  return parts
    .map((part) => String(part?.text ?? ""))
    .join("\n")
    .trim();
}

function getGeminiModelCache() {
  const globalRef = globalThis as typeof globalThis & {
    [GEMINI_MODELS_CACHE_KEY]?: GeminiModelCache;
  };

  const cache = globalRef[GEMINI_MODELS_CACHE_KEY];
  if (!cache) return null;
  if (!Array.isArray(cache.models) || !cache.models.length) return null;
  if (Date.now() - cache.fetchedAt > GEMINI_MODELS_CACHE_TTL_MS) return null;

  return cache.models;
}

function setGeminiModelCache(models: string[]) {
  const globalRef = globalThis as typeof globalThis & {
    [GEMINI_MODELS_CACHE_KEY]?: GeminiModelCache;
  };

  globalRef[GEMINI_MODELS_CACHE_KEY] = {
    fetchedAt: Date.now(),
    models: Array.from(new Set(models.filter(Boolean)))
  };
}

function sortGeminiModels(models: string[]) {
  const ranking = new Map<string, number>(
    GEMINI_MODEL_PREFERENCES.map((name, index) => [name, index])
  );

  return [...models].sort((a, b) => {
    const left = ranking.get(a) ?? Number.MAX_SAFE_INTEGER;
    const right = ranking.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (left !== right) return left - right;
    return a.localeCompare(b);
  });
}

async function listGeminiGenerateModels(apiKey: string): Promise<string[] | null> {
  const discovered = new Set<string>();
  let pageToken: string | null = null;

  for (let page = 0; page < 4; page += 1) {
    const params = new URLSearchParams({ key: apiKey });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?${params.toString()}`, {
      method: "GET",
      cache: "no-store"
    });

    const payload = (await res.json().catch(() => null)) as {
      models?: Array<{ name?: unknown; supportedGenerationMethods?: unknown }>;
      nextPageToken?: unknown;
      error?: { message?: unknown };
    } | null;

    if (!res.ok) {
      return null;
    }

    const models = Array.isArray(payload?.models) ? payload.models : [];
    for (const model of models) {
      const modelName = normalizeGeminiModelName(model?.name);
      if (!modelName || !isTextGeminiModel(modelName)) continue;

      const methods = Array.isArray(model?.supportedGenerationMethods)
        ? model.supportedGenerationMethods.map((method) => String(method).toLowerCase())
        : [];

      if (!methods.includes("generatecontent")) continue;
      discovered.add(modelName);
    }

    pageToken = typeof payload?.nextPageToken === "string" && payload.nextPageToken ? payload.nextPageToken : null;
    if (!pageToken) break;
  }

  const models = sortGeminiModels(Array.from(discovered));
  return models.length ? models : null;
}

async function getGeminiModels(apiKey: string, options?: { forceRefresh?: boolean }) {
  if (!options?.forceRefresh) {
    const cached = getGeminiModelCache();
    if (cached?.length) return cached;
  }

  const discovered = await listGeminiGenerateModels(apiKey).catch(() => null);
  const models = discovered?.length ? discovered : [...GEMINI_MODELS_FALLBACK];
  setGeminiModelCache(models);
  return models;
}

async function runOpenAi(args: ProviderRunArgs): Promise<ProviderRunResult> {
  const client = getOpenAIClient();
  if (!client) return { text: null, model: null, error: "OpenAI key missing." };

  let lastError = "OpenAI model failed.";

  for (const model of OPENAI_MODELS) {
    try {
      const completion = await client.chat.completions.create({
        model,
        temperature: args.temperature ?? 0.4,
        ...(args.maxTokens ? { max_tokens: args.maxTokens } : {}),
        ...(args.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user }
        ]
      });

      const text = String(completion.choices[0]?.message?.content ?? "").trim();
      if (text) return { text, model, error: null };
      lastError = `OpenAI ${model} returned empty content.`;
    } catch (error) {
      lastError = `OpenAI ${model}: ${trimError(error)}`;
    }
  }

  return { text: null, model: null, error: lastError };
}

async function runGroq(args: ProviderRunArgs): Promise<ProviderRunResult> {
  const env = getServerEnv();
  if (!env.GROQ_API_KEY) return { text: null, model: null, error: "Groq key missing." };

  let lastError = "Groq model failed.";

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          temperature: args.temperature ?? 0.4,
          ...(args.maxTokens ? { max_tokens: args.maxTokens } : {}),
          ...(args.jsonMode ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: args.system },
            { role: "user", content: args.user }
          ]
        }),
        cache: "no-store"
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = String((json as { error?: { message?: unknown } } | null)?.error?.message ?? `HTTP ${res.status}`);
        lastError = `Groq ${model}: ${detail}`.slice(0, 280);
        continue;
      }

      const text = String((json as { choices?: Array<{ message?: { content?: unknown } }> } | null)?.choices?.[0]?.message?.content ?? "").trim();
      if (text) return { text, model, error: null };
      lastError = `Groq ${model} returned empty content.`;
    } catch (error) {
      lastError = `Groq ${model}: ${trimError(error)}`;
    }
  }

  return { text: null, model: null, error: lastError };
}

async function runGemini(args: ProviderRunArgs): Promise<ProviderRunResult> {
  const env = getServerEnv();
  if (!env.GEMINI_API_KEY) return { text: null, model: null, error: "Gemini key missing." };

  let lastError = "Gemini model failed.";

  const prompt = [
    "System instructions:",
    args.system,
    "",
    "User request:",
    args.user,
    args.jsonMode ? "Return valid JSON only." : ""
  ]
    .filter(Boolean)
    .join("\n");

  let models = await getGeminiModels(env.GEMINI_API_KEY);
  let refreshedModels = false;

  while (models.length) {
    let sawModelLookupFailure = false;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: args.temperature ?? 0.4,
              ...(args.maxTokens ? { maxOutputTokens: args.maxTokens } : {})
            }
          }),
          cache: "no-store"
        });

        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          const detail = String((payload as { error?: { message?: unknown } } | null)?.error?.message ?? `HTTP ${res.status}`);
          if (/not found|not supported/i.test(detail)) sawModelLookupFailure = true;
          lastError = `Gemini ${model}: ${detail}`.slice(0, 280);
          continue;
        }

        const text = extractGeminiText(payload);
        if (text) return { text, model, error: null };
        lastError = `Gemini ${model} returned empty content.`;
      } catch (error) {
        lastError = `Gemini ${model}: ${trimError(error)}`;
      }
    }

    if (!refreshedModels && sawModelLookupFailure) {
      refreshedModels = true;
      models = await getGeminiModels(env.GEMINI_API_KEY, { forceRefresh: true });
      continue;
    }

    break;
  }

  return { text: null, model: null, error: lastError };
}

async function runProvider(provider: AiProvider, args: ProviderRunArgs): Promise<ProviderRunResult> {
  if (provider === "openai") return runOpenAi(args);
  if (provider === "groq") return runGroq(args);
  return runGemini(args);
}

export async function generateTextWithFallback(args: ProviderRunArgs): Promise<AiTextResult> {
  const providers = providerOrder();
  if (!providers.length) {
    return { text: null, provider: null, model: null, error: "No AI provider key configured." };
  }

  let lastError = "No AI provider returned a response.";

  for (const provider of providers) {
    const result = await runProvider(provider, args);
    if (result.text) {
      return {
        text: result.text,
        provider,
        model: result.model,
        error: null
      };
    }
    if (result.error) lastError = result.error;
  }

  return { text: null, provider: null, model: null, error: lastError };
}

export async function generateJsonWithFallback<T = any>(args: ProviderRunArgs & { validate?: (value: any) => T | null }): Promise<AiJsonResult<T>> {
  const providers = providerOrder();
  if (!providers.length) {
    return {
      value: null,
      rawText: null,
      provider: null,
      model: null,
      error: "No AI provider key configured."
    };
  }

  let lastError = "No AI provider returned valid JSON.";

  for (const provider of providers) {
    const result = await runProvider(provider, { ...args, jsonMode: true });
    if (!result.text) {
      if (result.error) lastError = result.error;
      continue;
    }

    const parsed = parseJsonObject(result.text);
    if (!parsed) {
      lastError = `${provider} ${result.model ?? "model"} returned non-JSON output.`;
      continue;
    }

    const validated = args.validate ? args.validate(parsed) : (parsed as T);
    if (!validated) {
      lastError = `${provider} ${result.model ?? "model"} JSON did not match required shape.`;
      continue;
    }

    return {
      value: validated,
      rawText: result.text,
      provider,
      model: result.model,
      error: null
    };
  }

  return {
    value: null,
    rawText: null,
    provider: null,
    model: null,
    error: lastError
  };
}
