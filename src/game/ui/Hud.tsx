import { applyItemToFocus, clueNote, itemLabel, promptFor } from '../interaction/actions'
import { useHud } from '../interaction/hudState'
import { useGame } from '../store'
import './hud.css'

// Crosshair, prompt, messages, battery, item bar and the level-complete card.
// Nothing here takes pointer events except real buttons.
export function Hud() {
  const touch = useGame((s) => s.touch)
  const uiLock = useGame((s) => s.uiLock)
  const cameraRaised = useGame((s) => s.cameraRaised)
  const focus = useGame((s) => s.focus)
  const clues = useGame((s) => s.clues)
  // Subscribed so the prompt and the note re-evaluate when the chain moves on.
  useGame((s) => s.flags)
  useGame((s) => s.items)
  useGame((s) => s.pickedUp)
  const message = useHud((s) => s.message)
  const messageId = useHud((s) => s.messageId)

  if (uiLock === 'complete') return <CompleteCard />

  const aiming = !uiLock && !cameraRaised
  const prompt = aiming ? promptFor(focus) : null
  const note = clues.length > 0 ? clueNote() : null

  return (
    <div className={`hud${touch ? ' is-touch' : ''}`}>
      {aiming && <div className={`hud-crosshair${prompt?.usable ? ' is-focused' : ''}`} />}
      {prompt && (
        <div className={`hud-prompt${prompt.usable ? '' : ' is-hint'}`}>
          {prompt.usable && !touch && <kbd>E</kbd>}
          <span>{prompt.label}</span>
        </div>
      )}
      {message && !uiLock && (
        <div key={messageId} className="hud-message" role="status">
          {message}
        </div>
      )}
      <div className="hud-status">
        <Battery />
        {touch && <ItemBar />}
        {note && <div className="hud-note">{note}</div>}
      </div>
      {!touch && <ItemBar />}
      {!touch && <Controls />}
    </div>
  )
}

const CONTROLS = [
  ['WASD', 'Move'],
  ['E', 'Interact'],
  ['F', 'Light'],
  ['Q', 'White / UV'],
  ['R', 'Swap battery'],
  ['RMB', 'Camera'],
  ['LMB', 'Shoot'],
] as const

// Always-on key reference, bottom-left. Desktop only: on touch that corner
// is the joystick and the buttons carry their own labels.
function Controls() {
  return (
    <dl className="hud-controls" aria-label="Controls">
      {CONTROLS.map(([key, action]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{action}</dd>
        </div>
      ))}
    </dl>
  )
}

function Battery() {
  const level = useGame((s) => s.batteryLevel)
  const spares = useGame((s) => s.spares)
  const swapping = useGame((s) => s.swapping)
  const lightOn = useGame((s) => s.lightOn)
  const mode = useGame((s) => s.lightMode)
  const touch = useGame((s) => s.touch)

  const cells = { full: 3, medium: 2, low: 1, empty: 0 }[level]
  const weak = level === 'low' || level === 'empty'
  const classes = [
    'hud-battery',
    `is-${level}`,
    `is-${mode}`,
    swapping ? 'is-swapping' : '',
    lightOn ? '' : 'is-off',
  ]
  return (
    <div
      className={classes.filter(Boolean).join(' ')}
      role="img"
      aria-label={`Battery ${level}, ${spares} spare, ${mode === 'uv' ? 'UV' : 'white'} light`}
    >
      <div className="hud-battery-shell">
        {[0, 1, 2].map((i) => (
          <i key={i} className={i < cells ? 'is-lit' : ''} />
        ))}
      </div>
      <span className="hud-battery-mode">{mode === 'uv' ? 'UV' : ''}</span>
      {spares > 0 && <span className="hud-battery-spares">+{spares}</span>}
      {swapping ? (
        <span className="hud-battery-text">Swapping…</span>
      ) : (
        weak &&
        (spares > 0 ? (
          <span className="hud-battery-text">{touch ? 'Swap the pack' : 'R to swap'}</span>
        ) : (
          level === 'empty' && <span className="hud-battery-text">Dead</span>
        ))
      )}
    </div>
  )
}

function ItemBar() {
  const items = useGame((s) => s.items)
  const held = Object.keys(items).filter((id) => items[id] > 0)
  if (held.length === 0) return null
  return (
    <div className="hud-items">
      {held.map((id) => (
        <button
          key={id}
          type="button"
          className="hud-item"
          aria-label={`Use ${itemLabel(id)}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            applyItemToFocus(id)
          }}
        >
          {id === 'key' ? <KeyIcon /> : <span className="hud-item-dot" />}
          <span>{itemLabel(id)}</span>
          {items[id] > 1 && <em>×{items[id]}</em>}
        </button>
      ))}
    </div>
  )
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 28 14" width="28" height="14" aria-hidden="true">
      <circle cx="6" cy="7" r="4.4" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path
        d="M10.5 7H26M21 7v4M25 7v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CompleteCard() {
  const photos = useGame((s) => s.photos)
  const best = photos.reduce<(typeof photos)[number] | null>(
    (top, p) => (!top || p.score > top.score ? p : top),
    null,
  )
  return (
    <div className="hud-complete" role="dialog" aria-modal="true" aria-label="Level complete">
      <div className="hud-complete-card">
        <p className="hud-complete-eyebrow">3.17 · the study</p>
        <h2>Level complete</h2>
        <p className="hud-complete-line">The lock turns. Cold air from the hallway.</p>
        {best && (
          <figure className="hud-complete-photo">
            <img src={best.url} alt="Your best photograph" />
            <figcaption>
              Best photograph <strong>{Math.round(best.score)}</strong>
            </figcaption>
          </figure>
        )}
        <button type="button" className="hud-complete-btn" onClick={() => window.location.reload()}>
          Play again
        </button>
      </div>
    </div>
  )
}
