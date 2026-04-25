import { generateText, type LanguageModel } from "ai"
import { groq } from "@ai-sdk/groq"
import { google } from "@ai-sdk/google"
import { anthropic } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"

export type ProviderName = "groq" | "google" | "anthropic" | "openai"

type ResolvedModel = { model: LanguageModel; provider: ProviderName }

/**
 * Build the full provider chain in priority order.
 * - Groq llama-3.1-8b-instant: free, fastest, 500k TPD on free tier.
 * - Google Gemini 1.5 Flash: free, generous quota — used as automatic failover.
 * - Anthropic / OpenAI: only used if their keys are explicitly set.
 *
 * The route walks this chain on retryable errors (429, 502, 503), so when
 * Groq's daily token cap is hit, Gemini takes over without user intervention.
 */
export function resolveProviderChain(): ResolvedModel[] {
  const chain: ResolvedModel[] = []
  if (process.env.GROQ_API_KEY) {
    chain.push({ model: groq("llama-3.1-8b-instant"), provider: "groq" })
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    chain.push({ model: google("gemini-1.5-flash-latest"), provider: "google" })
  }
  if (process.env.ANTHROPIC_API_KEY) {
    chain.push({ model: anthropic("claude-3-5-haiku-latest"), provider: "anthropic" })
  }
  if (process.env.OPENAI_API_KEY) {
    chain.push({ model: openai("gpt-4o-mini"), provider: "openai" })
  }
  return chain
}

/** First-available provider, kept for compatibility with older call sites. */
export function resolveModel(): ResolvedModel | null {
  return resolveProviderChain()[0] ?? null
}

export const NO_PROVIDER_MESSAGE =
  "No AI provider configured. Add GROQ_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY to your environment variables and redeploy."

function getStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined
  const e = err as { statusCode?: number; status?: number; cause?: { statusCode?: number } }
  return e.statusCode ?? e.status ?? e.cause?.statusCode
}

function isRetryable(err: unknown): boolean {
  const status = getStatus(err)
  if (status === 429 || status === 502 || status === 503 || status === 504) return true
  // Groq returns 413/400 for daily cap on some accounts — check the message.
  const msg = String((err as { message?: string })?.message ?? "").toLowerCase()
  return (
    msg.includes("rate limit") ||
    msg.includes("tokens per day") ||
    msg.includes("tpd") ||
    msg.includes("quota")
  )
}

/**
 * Run generateText with two layers of resilience:
 *   1. Exponential backoff retries on the current provider.
 *   2. Automatic failover to the next provider in the chain when the current
 *      provider keeps failing (e.g. daily token cap exhausted).
 *
 * `args.model` is replaced with each chain entry's model, so callers can pass
 * any LanguageModel as a placeholder — it's overridden internally.
 */
export async function generateWithRetry(
  args: Parameters<typeof generateText>[0],
  attemptsPerProvider = 3,
): Promise<{ text: string; provider: ProviderName }> {
  const chain = resolveProviderChain()
  if (chain.length === 0) throw new Error(NO_PROVIDER_MESSAGE)

  let lastErr: unknown
  for (let p = 0; p < chain.length; p++) {
    const { model, provider } = chain[p]
    for (let attempt = 0; attempt < attemptsPerProvider; attempt++) {
      try {
        const result = await generateText({ ...args, model })
        return { text: result.text, provider }
      } catch (err) {
        lastErr = err
        if (!isRetryable(err)) throw err

        // Last attempt on this provider AND there's another provider — fail over.
        if (attempt === attemptsPerProvider - 1) {
          if (p < chain.length - 1) break // try next provider
          throw err
        }

        // Backoff before retrying same provider: ~500ms, 1.4s, 3s.
        const wait = 500 * Math.pow(2.2, attempt) + Math.random() * 350
        await new Promise((r) => setTimeout(r, wait))
      }
    }
  }
  throw lastErr ?? new Error("All providers failed.")
}

export function extractApiErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { statusCode?: number; message?: string }
    const status = getStatus(err)
    const msg = String(e.message ?? "").toLowerCase()
    if (msg.includes("tokens per day") || msg.includes("tpd")) {
      return "Daily token cap reached on every configured AI provider. Add another key (Gemini is free) or wait until tomorrow's reset."
    }
    if (status === 429) {
      return "Rate limit hit on every configured AI provider. Wait ~30 seconds, or add a fallback key (Gemini is free)."
    }
    if (status === 401 || status === 403) {
      return "AI provider rejected the API key. Check the key value and that the API is enabled."
    }
    if (typeof e.message === "string" && e.message.length > 0) {
      return e.message.split("\n")[0].slice(0, 240)
    }
  }
  return "AI provider call failed."
}
