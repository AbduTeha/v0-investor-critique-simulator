import { generateText, type LanguageModel } from "ai"
import { google } from "@ai-sdk/google"
import { anthropic } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"
import { INVESTORS, VERDICT_PROMPT } from "@/lib/investors"

export const maxDuration = 60
export const runtime = "nodejs"

/**
 * Provider auto-detection.
 * - Prefers GOOGLE_GENERATIVE_AI_API_KEY (Gemini — fast and cheap).
 *   Uses gemini-1.5-flash-latest because gemini-2.0-flash has zero free-tier
 *   quota on most newly-issued keys.
 * - Then ANTHROPIC_API_KEY.
 * - Then OPENAI_API_KEY.
 */
function resolveModel(): { model: LanguageModel; provider: "google" | "anthropic" | "openai" } | null {
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

/**
 * Wrap generateText with exponential backoff on 429 (rate-limit) responses.
 * Free-tier Gemini keys can briefly throttle when 6 calls fire in parallel.
 */
async function generateWithRetry(
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
      const status = (err as { statusCode?: number; status?: number })?.statusCode
        ?? (err as { status?: number })?.status
      const isRateLimit = status === 429
      const isRetryable = isRateLimit || status === 503 || status === 502
      if (!isRetryable || attempt === maxAttempts - 1) break

      // Exponential backoff with jitter: 600ms, 1.5s, 3.5s
      const base = 600 * Math.pow(2.2, attempt)
      const jitter = Math.random() * 400
      await new Promise((r) => setTimeout(r, base + jitter))
    }
  }
  throw lastErr
}

function extractApiErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { statusCode?: number; message?: string; responseBody?: string }
    if (e.statusCode === 429) {
      return "Rate limit hit on the AI provider (free tier). Wait ~30 seconds and try again, or upgrade the key."
    }
    if (e.statusCode === 401 || e.statusCode === 403) {
      return "AI provider rejected the API key. Check the key value and that the API is enabled."
    }
    if (typeof e.message === "string" && e.message.length > 0) {
      // Trim the verbose error to something readable in the UI
      return e.message.split("\n")[0].slice(0, 240)
    }
  }
  return "AI provider call failed."
}

export async function POST(req: Request) {
  try {
    const { pitch } = (await req.json()) as { pitch?: string }

    if (!pitch || typeof pitch !== "string" || pitch.trim().length < 10) {
      return Response.json({ error: "Pitch must be at least 10 characters." }, { status: 400 })
    }

    const resolved = resolveModel()
    if (!resolved) {
      return Response.json(
        {
          error:
            "No AI provider configured. Add GOOGLE_GENERATIVE_AI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY to your environment variables and redeploy.",
        },
        { status: 503 },
      )
    }
    const { model } = resolved

    const trimmedPitch = pitch.trim()

    // ALL 5 investors fire IN PARALLEL — this is what makes the demo feel fast.
    // Each call retries on 429 so a brief rate-limit blip doesn't break the run.
    const critiquePromises = INVESTORS.map(async (investor) => {
      try {
        const { text } = await generateWithRetry({
          model,
          system: investor.systemPrompt,
          prompt: `The founder just pitched the following:\n\n"""${trimmedPitch}"""\n\nDeliver your critique now. Stay in character. 3-5 sentences MAX. No greeting. Open with the kill shot.`,
          temperature: 0.85,
          maxOutputTokens: 280,
        })
        return {
          id: investor.id,
          name: investor.name,
          critique: text.trim(),
          ok: true as const,
          errorMessage: null as string | null,
        }
      } catch (err) {
        console.error(`[v0] critique failed for ${investor.id}:`, err)
        return {
          id: investor.id,
          name: investor.name,
          critique: `${investor.name} stepped out of the room. (Provider error.)`,
          ok: false as const,
          errorMessage: extractApiErrorMessage(err),
        }
      }
    })

    const critiques = await Promise.all(critiquePromises)

    // If every investor failed, surface the real underlying reason.
    if (critiques.every((c) => !c.ok)) {
      const firstReason = critiques.find((c) => c.errorMessage)?.errorMessage
        ?? "All investor calls failed."
      return Response.json({ error: firstReason }, { status: 502 })
    }

    // Compose the panel transcript and ask for the verdict (6th call).
    const transcript = critiques
      .map((c) => {
        const inv = INVESTORS.find((i) => i.id === c.id)!
        return `${inv.name} (${inv.attackVector}):\n${c.critique}`
      })
      .join("\n\n")

    let score = 35
    let verdict = "The room is unconvinced."
    let mustFix = "Sharpen the single most important reason this needs to exist now."

    try {
      const { text: verdictRaw } = await generateWithRetry({
        model,
        system: VERDICT_PROMPT,
        prompt: `PITCH:\n"""${trimmedPitch}"""\n\nPANEL CRITIQUES:\n${transcript}\n\nReturn the JSON now.`,
        temperature: 0.4,
        maxOutputTokens: 300,
      })

      const cleaned = verdictRaw
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim()

      // Be lenient: extract the first JSON object if the model wrapped it in prose.
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned)

      score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)))
      if (parsed.verdict) verdict = String(parsed.verdict).trim()
      if (parsed.mustFix) mustFix = String(parsed.mustFix).trim()
    } catch (err) {
      console.error("[v0] verdict parse failed:", err)
      // Fallbacks above stay in place.
    }

    return Response.json({
      critiques: critiques.map(({ id, name, critique }) => ({ id, name, critique })),
      score,
      verdict,
      mustFix,
    })
  } catch (err) {
    console.error("[v0] /api/critique error:", err)
    return Response.json(
      { error: extractApiErrorMessage(err) },
      { status: 500 },
    )
  }
}
