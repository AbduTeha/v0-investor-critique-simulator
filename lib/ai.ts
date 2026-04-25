import { generateText, type LanguageModel } from "ai"
import { groq } from "@ai-sdk/groq"
import { google } from "@ai-sdk/google"
import { anthropic } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"

/**
 * Provider auto-detection.
 * - Prefers GROQ_API_KEY (free tier, no card, fastest inference).
 * - Then GOOGLE_GENERATIVE_AI_API_KEY (Gemini 1.5 Flash).
 * - Then ANTHROPIC_API_KEY, then OPENAI_API_KEY.
 */
export function resolveModel(): {
  model: LanguageModel
  provider: "groq" | "google" | "anthropic" | "openai"
} | null {
  if (process.env.GROQ_API_KEY) {
    return { model: groq("llama-3.3-70b-versatile"), provider: "groq" }
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return { model: google("gemini-1.5-flash-latest"), provider: "google" }
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { model: anthropic("claude-3-5-haiku-latest"), provider: "anthropic" }
  }
  if (process.env.OPENAI_API_KEY) {
    return { model: openai("gpt-4o-mini"), provider: "openai" }
  }
  return null
}

export const NO_PROVIDER_MESSAGE =
  "No AI provider configured. Add GROQ_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY to your environment variables and redeploy."

/**
 * Wrap generateText with exponential backoff on 429 / 502 / 503 responses.
 * Free-tier provider keys can briefly throttle when calls fire in parallel.
 */
export async function generateWithRetry(
  args: Parameters<typeof generateText>[0],
  maxAttempts = 4,
): Promise<{ text: string }> {
  let lastErr: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await generateText(args)
      return { text: result.text }
    } catch (err) {
      lastErr = err
      const status =
        (err as { statusCode?: number; status?: number })?.statusCode ??
        (err as { status?: number })?.status
      const isRetryable = status === 429 || status === 502 || status === 503
      if (!isRetryable || attempt === maxAttempts - 1) break

      // Exponential backoff with jitter: ~600ms, 1.5s, 3.5s
      const base = 600 * Math.pow(2.2, attempt)
      const jitter = Math.random() * 400
      await new Promise((r) => setTimeout(r, base + jitter))
    }
  }
  throw lastErr
}

export function extractApiErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { statusCode?: number; message?: string }
    if (e.statusCode === 429) {
      return "Rate limit hit on the AI provider (free tier). Wait ~30 seconds and try again, or upgrade the key."
    }
    if (e.statusCode === 401 || e.statusCode === 403) {
      return "AI provider rejected the API key. Check the key value and that the API is enabled."
    }
    if (typeof e.message === "string" && e.message.length > 0) {
      return e.message.split("\n")[0].slice(0, 240)
    }
  }
  return "AI provider call failed."
}
