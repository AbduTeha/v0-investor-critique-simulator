"use client"

import { useEffect, useState } from "react"

/**
 * Reveals `text` one character at a time once `start` is true.
 * Calls `onDone` when fully revealed.
 */
export function useTypewriter(
  text: string,
  start: boolean,
  speedMs = 12,
  onDone?: () => void,
) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!start) {
      setDisplayed("")
      setDone(false)
      return
    }

    let i = 0
    setDisplayed("")
    setDone(false)

    const tick = () => {
      i += 1
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        setDone(true)
        onDone?.()
        return
      }
      timer = window.setTimeout(tick, speedMs)
    }

    let timer = window.setTimeout(tick, speedMs)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, start, speedMs])

  return { displayed, done }
}
