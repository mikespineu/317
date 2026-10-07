import { applyItemToFocus, clueNote, heldPrompt, itemLabel, promptFor } from '../interaction/actions'
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
  const held = useGame((s) => s.held)
  const hasLight = useGame((s) => s.hasLight)
  const batteryLevel = useGame((s) => s.batteryLevel)
  const spares = useGame((s) => s.spares)
  const swapping = useGame((s) => s.swapping)
  const clues = useGame((s) => s.clues)
  // Subscribed so the prompt and the note re-evaluate when the chain moves on.
  useGame((s) => s.flags)
  useGame((s) => s.items)
  useGame((s) => s.pickedUp)
  const message = useHud((s) => s.message)
  const messageId = useHud((s) => s.messageId)

  if (uiLock === 'complete') return <CompleteCard />

  const aiming = !uiLock && !cameraRaised
  const prompt = aiming ? (held ? heldPrompt(held) : promptFor(focus)) : null
  const note = hasLight && clues.length > 0 ? clueNote() : null
  const guide = uiLock ? null : guideFor({ touch, hasLight, batteryLevel, spares, swapping })

  return (
    <div className={`hud${touch ? ' is-touch' : ''}`}>
      {aiming && <div className={`hud-crosshair${prompt?.usable && !held ? ' is-focused' : ''}`} />}
      {guide && (
        <div
          key={guide.id}
          className={`hud-guide print-paper${guide.urgent ? ' is-urgent' : ''}`}
          role="status"
        >
          {guide.before}
          {guide.key && <kbd>{guide.key}</kbd>}
          {guide.after}
        </div>
      )}
      {prompt && (
        <div className={`hud-prompt${prompt.usable ? ' print-paper' : ' is-hint'}`}>
          {prompt.usable && !touch && <kbd>E</kbd>}
          <span>{prompt.label}</span>
        </div>
      )}
      {message && !uiLock && (
        <div key={messageId} className="hud-message print-paper" role="status">
          {message}
        </div>
      )}
      <div className="hud-status">
        {hasLight && <Battery />}
        {touch && <ItemBar />}
        {note && <div className="hud-note print-ink">{note}</div>}
      </div>
      {!touch && <ItemBar />}
      {!touch && <Controls hasLight={hasLight} />}
    </div>
  )
}

interface Guide {
  id: string // changes when the text does, so the label re-enters
  before: string
  key?: string // a key shown as a seal between `before` and `after`
  after?: string
  urgent?: boolean
}

// The standing instruction for what to do next, or null when nothing is
// needed: first find the flashlight, then keep it powered.
function guideFor(s: {
  touch: boolean
  hasLight: boolean
  batteryLevel: string
  spares: number
  swapping: boolean
}): Guide | null {
  if (!s.hasLight) {
    return s.touch
      ? { id: 'find-light', before: 'Too dark to see. Find the flashlight on the floor and tap it.' }
      : {
          id: 'find-light',
          before: 'Too dark to see. Find the flashlight on the floor and press ',
          key: 'E',
          after: ' to pick it up.',
        }
  }
  const weak = s.batteryLevel === 'low' || s.batteryLevel === 'empty'
  if (!weak || s.swapping) return null
  const state = s.batteryLevel === 'empty' ? 'Battery dead.' : 'Battery low.'
  if (s.spares > 0) {
    return s.touch
      ? { id: 'swap', urgent: true, before: `${state} Tap the battery button to charge with your spare.` }
      : {
          id: 'swap',
          urgent: true,
          before: `${state} Press `,
          key: 'R',
          after: ' to charge it with your spare pack.',
        }
  }
  return s.touch
    ? { id: 'find-pack', urgent: true, before: `${state} Find a battery pack, then tap the battery button.` }
    : {
        id: 'find-pack',
        urgent: true,
        before: `${state} Find a battery pack, then press `,
        key: 'R',
        after: ' to charge it.',
      }
}

// `true` marks the keys that do nothing until the flashlight is in hand.
const CONTROLS = [
  ['WASD', 'Move', false],
  ['E', 'Interact', false],
  ['F', 'Light', true],
  ['Q', 'White / UV', true],
  ['R', 'Swap battery', true],
  ['RMB', 'Camera', false],
  ['LMB', 'Shoot', false],
] as const

// Always-on key reference, bottom-left. Desktop only: on touch that corner
// is the joystick and the buttons carry their own labels.
function Controls({ hasLight }: { hasLight: boolean }) {
  return (
    <dl className="hud-controls print-ink" aria-label="Controls">
      {CONTROLS.filter(([, , needsLight]) => hasLight || !needsLight).map(([key, action]) => (
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
    'hud-battery print-ink',
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
          className="hud-item print-paper"
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
      <div className="hud-complete-card print-paper">
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
