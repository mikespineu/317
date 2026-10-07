import { useEffect, useRef, useState } from 'react'
import {
  LOCK_TARGET_ATTR,
  installDesktopInput,
  setPortrait,
} from '../player/desktopInput'
import { useGame } from '../store'
import './rotate-prompt.css'

const coarse = () => window.matchMedia?.('(pointer: coarse)').matches ?? false

const CONTROLS: [keys: string, action: string][] = [
  ['W A S D', 'Move'],
  ['Mouse', 'Look'],
  ['E / Click', 'Interact'],
  ['F', 'Light on / off'],
  ['Q', 'White / UV'],
  ['R', 'Swap battery'],
  ['Right mouse', 'Raise camera, click to shoot'],
  ['Esc', 'Pause'],
]

// Shell overlays: the portrait prompt (touch) and the click-to-play / paused
// card (desktop). Also installs the desktop input, since both need to be up
// before the room has loaded.
export function RotatePrompt() {
  const root = useRef<HTMLDivElement>(null)
  const touch = useGame((s) => s.touch)
  const paused = useGame((s) => s.paused)
  const modal = useGame((s) => s.uiLock !== null)
  const [portrait, setPortraitState] = useState(false)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const game = root.current?.parentElement
    if (game) return installDesktopInput(game)
  }, [])

  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(orientation: portrait)')
    const update = () => {
      const value = mq.matches && (touch || coarse())
      setPortraitState(value)
      setPortrait(value)
    }
    update()
    mq.addEventListener('change', update)
    return () => {
      mq.removeEventListener('change', update)
      setPortrait(false)
    }
  }, [touch])

  useEffect(() => {
    if (!paused) setStarted(true)
  }, [paused])

  const lockTarget = { [LOCK_TARGET_ATTR]: '' }

  return (
    <div ref={root} className="shell">
      {portrait && (
        <div className="shell-rotate" role="alert">
          <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <rect className="shell-rotate-phone" x="22" y="10" width="20" height="36" rx="3" />
            <path d="M12 44a22 22 0 0 0 20 14M32 58l-5-5M32 58l-5 4" strokeLinecap="round" />
          </svg>
          <p className="shell-title">Rotate your device</p>
          <p className="shell-note">3.17 plays in landscape.</p>
        </div>
      )}
      {!portrait && !touch && paused && !modal && (
        <div className="shell-pause" {...lockTarget}>
          <div className="shell-card print-paper">
            <p className="shell-kicker">3.17</p>
            <p className="shell-title">{started ? 'Paused' : 'Click to play'}</p>
            {started && <p className="shell-note">Click to resume</p>}
            {!started && (
              <ul className="shell-goals">
                <li>Find the way out of the room.</li>
                <li>Photograph the ghosts to prove they exist.</li>
              </ul>
            )}
            <dl className="shell-controls">
              {CONTROLS.map(([keys, action]) => (
                <div key={keys}>
                  <dt>{keys}</dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}
