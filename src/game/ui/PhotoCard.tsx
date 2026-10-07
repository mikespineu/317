import { useEffect } from 'react'
import { useGame } from '../store'
import type { PhotoParts } from '../store'
import { tuning } from '../tuning'
import './photo-card.css'

const PARTS: { key: keyof PhotoParts; label: string }[] = [
  { key: 'lit', label: 'Lit' },
  { key: 'framed', label: 'Framed' },
  { key: 'close', label: 'Close' },
  { key: 'sharp', label: 'Sharp' },
]

// Input that arrives right as the card appears belongs to the shot, not the card.
const GUARD_MS = 400
const CLOSE_KEYS = new Set(['KeyE', 'Escape', 'Enter', 'Space'])

// The photo just taken and what it scored. Open while uiLock is 'photo';
// game input is suppressed then, so the card listens for its own dismissal.
export function PhotoCard() {
  const open = useGame((s) => s.uiLock === 'photo')
  const shot = useGame((s) => s.lastShot)

  useEffect(() => {
    if (!open) return
    const openedAt = performance.now()
    const close = () => {
      if (useGame.getState().uiLock === 'photo') useGame.getState().setUiLock(null)
    }
    const dismiss = (e: Event) => {
      if (performance.now() - openedAt < GUARD_MS) return
      if (e instanceof KeyboardEvent) {
        if (!CLOSE_KEYS.has(e.code)) return
        e.preventDefault()
      }
      close()
    }
    const timer = window.setTimeout(close, tuning.photoCardSeconds * 1000)
    window.addEventListener('keydown', dismiss)
    window.addEventListener('click', dismiss)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', dismiss)
      window.removeEventListener('click', dismiss)
    }
  }, [open])

  if (!open || !shot) return null
  const { parts, score } = shot
  const found = parts !== null && score !== null

  return (
    <div className="photo-layer" role="dialog" aria-label="Photograph">
      <figure className={`photo-card${found ? '' : ' is-empty'}`}>
        <div className="photo-print">
          {shot.url ? (
            <img src={shot.url} alt="The photograph you just took" draggable={false} />
          ) : (
            <div className="photo-blank" />
          )}
          {shot.best && <span className="photo-best">Best</span>}
        </div>
        <figcaption className="photo-notes">
          {found ? (
            <>
              <p className="photo-total">
                <strong>{score}</strong>
                <span>points</span>
              </p>
              <ul className="photo-parts">
                {PARTS.map(({ key, label }) => (
                  <li key={key}>
                    <span className="photo-part-label">{label}</span>
                    <span className="photo-bar">
                      <span
                        className="photo-bar-fill"
                        style={{ transform: `scaleX(${Math.min(1, Math.max(0, parts[key]))})` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="photo-nothing">Nothing there…</p>
          )}
          <p className="photo-hint">Tap or press E to continue</p>
        </figcaption>
      </figure>
    </div>
  )
}
