import "server-only";

import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";

export function getOpenAIClient() {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

