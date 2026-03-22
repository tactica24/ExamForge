import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getServerEnv = vi.fn();
const getOpenAIClient = vi.fn();

vi.mock("@/lib/env", () => ({
  getServerEnv
}));

vi.mock("@/lib/ai/openai", () => ({
  getOpenAIClient
}));

import { generateTextWithFallback } from "@/lib/ai/multi";

describe("generateTextWithFallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    getOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "openai text" } }]
          })
        }
      }
    });
  });

  it("prefers Groq before Gemini and OpenAI when all are configured", async () => {
    getServerEnv.mockReturnValue({
      GROQ_API_KEY: "groq-key",
      GEMINI_API_KEY: "gemini-key",
      OPENAI_API_KEY: "openai-key"
    });

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("api.groq.com")) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "groq text" } }]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("generativelanguage.googleapis.com")) {
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "gemini text" }] } }]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const result = await generateTextWithFallback({
      system: "system",
      user: "user"
    });

    expect(result.provider).toBe("groq");
    expect(result.text).toBe("groq text");
    expect(String(fetchMock.mock.calls[0]?.[0] ?? "")).toContain("api.groq.com");
    expect(getOpenAIClient).not.toHaveBeenCalled();
  });
});
