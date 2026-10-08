import { useEffect, useRef, useState } from 'react'
import { AboutOverlay } from '#/components/AboutOverlay'
import { tr, useT } from '#/i18n'
import { carryBattery, imageDataUrl, recordRoom } from '#/lib/progress'
import { useRoomDef } from '../room/RoomContext'
import { runtime } from '../runtime'
import { useGame } from '../store'
import type { Photo } from '../store'
import './complete-card.css'

function clock(seconds: number) {
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

// The next room is another page load: a room is fixed for the life of the page.
// The battery goes along: what is left in the flashlight, and the spare packs.
function playRoom(id: string) {
  carryBattery(id, { charge: runtime.battery.charge, spares: useGame.getState().spares })
  window.location.assign(`/play?room=${encodeURIComponent(id)}`)
}

// The room-complete card: text from the definition, then whatever the room
// keeps score of (time, stars, photographs, secrets). Shown by the HUD while
// uiLock is 'complete'. The base card styles are the .hud-complete rules in
// hud.css.
export function CompleteCard() {
  const t = useT()
  const def = useRoomDef()
  const photos = useGame((s) => s.photos)
  const startedAt = useGame((s) => s.startedAt)
  const completedAt = useGame((s) => s.completedAt)

  const { eyebrow, line, next, stars } = def.complete
  const title = def.complete.title ? tr(def.complete.title) : t('complete.title')
  const seconds =
    startedAt !== null && completedAt !== null ? Math.max(0, completedAt - startedAt) / 1000 : null

  // The ghosts the room counts: secret and switched-off ones are left out.
  const ghosts = def.ghosts.filter((g) => !g.secret && g.enabled !== false)
  const shots = ghosts.map((g) => photos.find((p) => p.ghostId === g.id) ?? null)
  const best = photos.reduce<Photo | null>((top, p) => (!top || p.score > top.score ? p : top), null)

  const par = def.parSeconds
  const earned: [label: string, on: boolean][] = [
    [t('complete.star.exit'), true],
    [t(ghosts.length === 1 ? 'complete.star.ghost' : 'complete.star.ghosts'), shots.every(Boolean)],
    [
      par === undefined ? t('complete.star.time') : t('complete.star.under', { time: clock(par) }),
      seconds !== null && par !== undefined && seconds < par,
    ],
  ]

  // The run goes into the saved progress once, as the card appears.
  const [about, setAbout] = useState(false)
  const saved = useRef(false)
  useEffect(() => {
    if (saved.current) return
    saved.current = true
    const stars = def.complete.stars ? earned.filter(([, on]) => on).length : null
    void Promise.all(
      photos.map(async (p) => ({
        ghostId: p.ghostId,
        score: p.score,
        image: await imageDataUrl(p.url),
      })),
    ).then((kept) => recordRoom(def.id, { seconds, stars, photos: kept }))
  }, [])

  return (
    <div className="hud-complete" role="dialog" aria-modal="true" aria-label={title}>
      <div className="hud-complete-card print-paper">
        <p className="hud-complete-eyebrow">{tr(eyebrow)}</p>
        <h2>{title}</h2>
        <p className="hud-complete-line">{tr(line)}</p>
        {stars && (
          <ul
            className="complete-stars"
            aria-label={t('complete.stars', { n: earned.filter(([, on]) => on).length })}
          >
            {earned.map(([label, on]) => (
              <li key={label} className={on ? 'is-earned' : ''}>
                <Star />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        )}
        {stars && seconds !== null && (
          <p className="complete-time">
            {t('complete.time')} <strong>{clock(seconds)}</strong>
          </p>
        )}
        {ghosts.length > 1 ? (
          <div className="complete-photos">
            {shots.map((photo, i) =>
              photo ? (
                <figure key={ghosts[i].id} className="hud-complete-photo">
                  <img src={photo.url} alt={t('complete.photo.ghost', { n: i + 1 })} />
                  <figcaption>
                    <strong>{Math.round(photo.score)}</strong>
                  </figcaption>
                </figure>
              ) : (
                <figure key={ghosts[i].id} className="hud-complete-photo is-missing">
                  <div
                    className="complete-blank"
                    role="img"
                    aria-label={t('complete.photo.missing', { n: i + 1 })}
                  />
                  <figcaption>{t('complete.photo.none')}</figcaption>
                </figure>
              ),
            )}
          </div>
        ) : (
          best && (
            <figure className="hud-complete-photo">
              <img src={best.url} alt={t('complete.photo.bestAlt')} />
              <figcaption>
                {t('complete.photo.best')} <strong>{Math.round(best.score)}</strong>
              </figcaption>
            </figure>
          )
        )}
        {(def.secrets || next) && (
          <p className="complete-more">
            {def.secrets && (
              <span className="complete-secrets">
                {t('complete.secrets', { total: def.secrets.total })}
                {def.secrets.note && <em> — {tr(def.secrets.note)}</em>}
              </span>
            )}
            {next && <span>{t('complete.next', { next: tr(next) })}</span>}
          </p>
        )}
        <div className="complete-actions">
          {def.nextRoom && (
            <button
              type="button"
              className="hud-complete-btn"
              onClick={() => playRoom(def.nextRoom!)}
            >
              {t('complete.playNext')}
            </button>
          )}
          <button
            type="button"
            className={`hud-complete-btn${def.nextRoom ? ' is-second' : ''}`}
            onClick={() => window.location.reload()}
          >
            {t('complete.again')}
          </button>
        </div>
        <button type="button" className="complete-about" onClick={() => setAbout(true)}>
          {t('about.title')}
        </button>
      </div>
      {about && <AboutOverlay onClose={() => setAbout(false)} />}
    </div>
  )
}

function Star() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
      <path d="M12 2.2l2.9 6.5 7 .7-5.3 4.7 1.6 6.9L12 17.4 5.8 21l1.6-6.9L2.1 9.4l7-.7z" />
    </svg>
  )
}
