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
const GEMINI_MODELS = ["gemini-1.5-flash", "gemini-1.5-pro"] as const;

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
        const detail = String(json?.error?.message ?? `HTTP ${res.status}`);
        lastError = `Groq ${model}: ${detail}`.slice(0, 280);
        continue;
      }

      const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
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

  for (const model of GEMINI_MODELS) {
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

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = String(json?.error?.message ?? `HTTP ${res.status}`);
        lastError = `Gemini ${model}: ${detail}`.slice(0, 280);
        continue;
      }

      const text = String(
        json?.candidates?.[0]?.content?.parts
          ?.map((part: any) => String(part?.text ?? ""))
          .join("\n") ?? ""
      ).trim();

      if (text) return { text, model, error: null };
      lastError = `Gemini ${model} returned empty content.`;
    } catch (error) {
      lastError = `Gemini ${model}: ${trimError(error)}`;
    }
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
