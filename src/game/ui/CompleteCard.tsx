import { useRoomDef } from '../room/RoomContext'
import { useGame } from '../store'
import type { Photo } from '../store'
import './complete-card.css'

function clock(seconds: number) {
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

// The room-complete card: text from the definition, then whatever the room
// keeps score of (time, stars, photographs, secrets). Shown by the HUD while
// uiLock is 'complete'. The base card styles are the .hud-complete rules in
// hud.css.
export function CompleteCard() {
  const def = useRoomDef()
  const photos = useGame((s) => s.photos)
  const startedAt = useGame((s) => s.startedAt)
  const completedAt = useGame((s) => s.completedAt)

  const { eyebrow, title = 'Level complete', line, next, stars } = def.complete
  const seconds =
    startedAt !== null && completedAt !== null ? Math.max(0, completedAt - startedAt) / 1000 : null

  // The ghosts the room counts: secret and switched-off ones are left out.
  const ghosts = def.ghosts.filter((g) => !g.secret && g.enabled !== false)
  const shots = ghosts.map((g) => photos.find((p) => p.ghostId === g.id) ?? null)
  const best = photos.reduce<Photo | null>((top, p) => (!top || p.score > top.score ? p : top), null)

  const par = def.parSeconds
  const earned: [label: string, on: boolean][] = [
    ['Way out', true],
    [ghosts.length === 1 ? 'Ghost caught' : 'Every ghost', shots.every(Boolean)],
    [
      par === undefined ? 'In time' : `Under ${clock(par)}`,
      seconds !== null && par !== undefined && seconds < par,
    ],
  ]

  return (
    <div className="hud-complete" role="dialog" aria-modal="true" aria-label={title}>
      <div className="hud-complete-card print-paper">
        <p className="hud-complete-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="hud-complete-line">{line}</p>
        {stars && (
          <ul
            className="complete-stars"
            aria-label={`${earned.filter(([, on]) => on).length} of 3 stars`}
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
            Time <strong>{clock(seconds)}</strong>
          </p>
        )}
        {ghosts.length > 1 ? (
          <div className="complete-photos">
            {shots.map((photo, i) =>
              photo ? (
                <figure key={ghosts[i].id} className="hud-complete-photo">
                  <img src={photo.url} alt={`Your best photograph of ghost ${i + 1}`} />
                  <figcaption>
                    <strong>{Math.round(photo.score)}</strong>
                  </figcaption>
                </figure>
              ) : (
                <figure key={ghosts[i].id} className="hud-complete-photo is-missing">
                  <div className="complete-blank" role="img" aria-label={`Ghost ${i + 1} not photographed`} />
                  <figcaption>Not caught</figcaption>
                </figure>
              ),
            )}
          </div>
        ) : (
          best && (
            <figure className="hud-complete-photo">
              <img src={best.url} alt="Your best photograph" />
              <figcaption>
                Best photograph <strong>{Math.round(best.score)}</strong>
              </figcaption>
            </figure>
          )
        )}
        {(def.secrets || next) && (
          <p className="complete-more">
            {def.secrets && (
              <span className="complete-secrets">
                Secrets 0 of {def.secrets.total}
                {def.secrets.note && <em> — {def.secrets.note}</em>}
              </span>
            )}
            {next && <span>Next: {next} — coming soon</span>}
          </p>
        )}
        <button type="button" className="hud-complete-btn" onClick={() => window.location.reload()}>
          Play again
        </button>
      </div>
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
