# IdeaKiller

A brutal investor critique simulator. Type your pitch, and five investors — each attacking from a different angle — tear it apart in parallel. You get a 0–100 survival score and the one thing you must fix before a real pitch.

## The panel

| Investor       | Attack vector                                    |
| -------------- | ------------------------------------------------ |
| Viktor Holt    | Why now? Why not already dead?                   |
| Diana Marsh    | Your unit economics are fiction                  |
| James Osei     | Google ships this as a feature next quarter      |
| Yuki Tanaka    | There's no real tech here                        |
| Amara Diallo   | Why does this even need to exist?                |

## How it works

```
pitch ─► /api/critique ─► Promise.all([5 personas])  ─► verdict (6th call) ─► UI
                            │                              │
                            │ all 5 fire IN PARALLEL        │ score 0–100
                            │ (this is what makes it fast)  │ verdict line
                            │                              │ must-fix
```

The UI then reveals the cards **sequentially** with a typewriter animation so the demo feels like a real room — even though the work was already done in parallel.

## Architecture

```
app/
  api/critique/route.ts      ← Promise.all over the 5 personas + verdict call
  page.tsx                    ← orchestrates phases: idle → loading → firing → done
  layout.tsx                  ← metadata, fonts, dark theme
components/
  pitch-input.tsx             ← textarea + sample-pitch button + "KILL MY IDEA" cta
  investor-card.tsx           ← per-investor card with typing animation
  score-panel.tsx             ← animated 0–100 counter, verdict, must-fix
  idea-killer-header.tsx      ← branded header
hooks/
  use-typewriter.ts           ← reveals text character-by-character
lib/
  investors.ts                ← the 5 system prompts + the verdict prompt
```

## Setup

```bash
pnpm install
cp .env.example .env.local   # then add your key
pnpm dev
```

You need one of:

- `ANTHROPIC_API_KEY` (preferred — uses `claude-3-5-haiku-latest`)
- `OPENAI_API_KEY` (fallback — uses `gpt-4o-mini`)

The route at `app/api/critique/route.ts` auto-detects which one is set.

## Deploy to Vercel

1. Push to GitHub and import the repo into Vercel.
2. In **Project Settings → Environment Variables**, add `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`) for the **Production**, **Preview**, and **Development** environments.
3. **Redeploy.** This is the #1 hackathon deploy failure: env vars added after the first deploy do not apply until you redeploy.

## Try it

Click **"Try the sample pitch"** for a pre-loaded pitch:

> An AI app that helps restaurants reduce food waste by predicting daily demand based on weather, events, and historical sales. Charges $99/month per restaurant.

Hit **KILL MY IDEA** and watch the room tear it apart.

## Tech

- Next.js (App Router)
- AI SDK 6 with `@ai-sdk/anthropic` and `@ai-sdk/openai`
- Tailwind CSS v4 + shadcn/ui
- Lucide icons
- TypeScript

## Performance note

The five investor calls fire with `Promise.all()` — total wall-clock time is roughly the slowest single call, not the sum. The verdict call runs after, sequentially, because it depends on the transcript. The UI reveals one card at a time for theatrical effect; the data is already in memory.
