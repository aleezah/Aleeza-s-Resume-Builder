import { useRef, useState } from 'react'

/**
 * Hook that drives an exponential-approach progress animation.
 * Call start() to begin, finish() when the operation completes, reset() on error.
 *
 * phases: array of [threshold%, labelString] pairs sorted ascending.
 */
export function useProgressBar(phases = []) {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase]       = useState('')
  const intervalRef = useRef(null)

  function start(initialPhase) {
    clearInterval(intervalRef.current)
    setProgress(0)
    setPhase(initialPhase || phases[0]?.[1] || 'Processing…')
    let pct = 0
    intervalRef.current = setInterval(() => {
      pct = Math.min(pct + (90 - pct) * 0.025, 90)
      setProgress(pct)
      // Pick the highest phase whose threshold has been crossed
      const hit = [...phases].reverse().find(([t]) => pct >= t)
      if (hit) setPhase(hit[1])
    }, 500)
  }

  function finish() {
    clearInterval(intervalRef.current)
    setProgress(100)
    setPhase('Done!')
    setTimeout(() => { setProgress(0); setPhase('') }, 1000)
  }

  function reset() {
    clearInterval(intervalRef.current)
    setProgress(0)
    setPhase('')
  }

  return { progress, phase, start, finish, reset }
}

/**
 * Renders an animated progress bar.
 * Shows only when progress > 0.
 * Shows the "don't refresh" warning while actively running (0 < progress < 100).
 */
export default function ProgressBar({ progress, phase }) {
  if (!progress) return null

  return (
    <div className="mt-3 space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400">{phase}</span>
        <span className="text-xs text-gray-500">{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      {progress > 0 && progress < 100 && (
        <p className="text-xs text-yellow-600 pt-0.5">
          ⚠ Do not refresh or close this tab — your data may be lost
        </p>
      )}
    </div>
  )
}
