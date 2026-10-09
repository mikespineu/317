import { useEffect, useRef, useState } from 'react'
import { AboutOverlay } from '#/components/AboutOverlay'
import { useT } from '#/i18n'
import type { Key } from '#/i18n'
import {
  LOCK_TARGET_ATTR,
  installDesktopInput,
  setTouchPaused,
  setPortrait,
} from '../player/desktopInput'
import { useGame } from '../store'
import './rotate-prompt.css'

const coarse = () => window.matchMedia?.('(pointer: coarse)').matches ?? false

// A key cap is the same in every language unless it is a dictionary key.
const CONTROLS: [keys: string, action: Key][] = [
  ['W A S D', 'pause.move'],
  ['pause.key.mouse', 'pause.look'],
  ['pause.key.interact', 'pause.interact'],
  ['F', 'pause.light'],
  ['Q', 'pause.mode'],
  ['R', 'pause.swap'],
  ['pause.key.photo', 'pause.photo'],
  ['pause.key.shoot', 'pause.shoot'],
  ['Esc', 'pause.leave'],
]

// Shell overlays: the portrait prompt (touch) and the click-to-play / paused
// card (desktop). Also installs the desktop input, since both need to be up
// before the room has loaded.
export function RotatePrompt() {
  const t = useT()
  const root = useRef<HTMLDivElement>(null)
  const touch = useGame((s) => s.touch)
  const paused = useGame((s) => s.paused)
  const modal = useGame((s) => s.uiLock !== null)
  const [portrait, setPortraitState] = useState(false)
  const [started, setStarted] = useState(false)
  const [about, setAbout] = useState(false)
  // A room without the UV lamp does not list its key.
  const uv = useGame((s) => s.hasUv)

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
          <p className="shell-title">{t('rotate.title')}</p>
          <p className="shell-note">{t('rotate.note')}</p>
        </div>
      )}
      {/* Desktop: the pointer lock was lost. Touch: the pause button. */}
      {!portrait && paused && !modal && (
        <div className="shell-pause" {...lockTarget} onClick={() => setTouchPaused(false)}>
          <div className="shell-card print-paper">
            <p className="shell-kicker">3.17</p>
            <p className="shell-title">{t(started || touch ? 'pause.paused' : 'pause.start')}</p>
            {touch ? (
              <p className="shell-note">{t('pause.resume.touch')}</p>
            ) : (
              started && <p className="shell-note">{t('pause.resume')}</p>
            )}
            {!started && !touch && (
              <ul className="shell-goals">
                <li>{t('goal.exit')}</li>
                <li>{t('goal.ghosts')}</li>
              </ul>
            )}
            {!touch && (
              <dl className="shell-controls">
                {CONTROLS.filter(([keys]) => uv || keys !== 'Q').map(([keys, action]) => (
                  <div key={keys}>
                    <dt>{keys.startsWith('pause.') ? t(keys as Key) : keys}</dt>
                    <dd>{t(action)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      )}
      {/* Outside the lock target, so clicking it does not take the pointer. */}
      {!portrait && paused && !modal && (
        <button type="button" className="shell-about" onClick={() => setAbout(true)}>
          {t('about.title')}
        </button>
      )}
      {about && <AboutOverlay onClose={() => setAbout(false)} />}
    </div>
  )
}
