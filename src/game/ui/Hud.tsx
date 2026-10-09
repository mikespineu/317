import { useT } from '#/i18n'
import type { Key } from '#/i18n'
import { applyItemToFocus, clueNote, heldPrompt, itemLabel, promptFor } from '../interaction/actions'
import { useHud } from '../interaction/hudState'
import { useRoomDef } from '../room/RoomContext'
import { useGame } from '../store'
import { CompleteCard } from './CompleteCard'
import { richParts, useGuide } from './guide'
import './hud.css'

// Crosshair, prompt, guide, messages, battery and item bar; the room-complete
// card takes over when the exit opens.
// Nothing here takes pointer events except real buttons.
export function Hud() {
  useT() // the prompt, guide and note are built outside React
  const touch = useGame((s) => s.touch)
  const uiLock = useGame((s) => s.uiLock)
  const cameraRaised = useGame((s) => s.cameraRaised)
  const focus = useGame((s) => s.focus)
  const held = useGame((s) => s.held)
  const hasLight = useGame((s) => s.hasLight)
  const clues = useGame((s) => s.clues)
  // Subscribed so the prompt and the note re-evaluate when the chain moves on.
  useGame((s) => s.flags)
  useGame((s) => s.items)
  useGame((s) => s.pickedUp)
  const message = useHud((s) => s.message)
  const messageId = useHud((s) => s.messageId)

  const label = useGuide()

  if (uiLock === 'complete') return <CompleteCard />
  // The intro is a cut: nothing on screen until control returns.
  if (uiLock === 'intro') return null

  // Every other lock (padlock, symbol lock, note, photo card) is a modal over
  // the game: no crosshair, prompt, guide or message under it.
  const aiming = !uiLock && !cameraRaised
  const prompt = aiming ? (held ? heldPrompt(held) : promptFor(focus)) : null
  const note = hasLight && clues.length > 0 ? clueNote() : null
  const guide = uiLock ? null : label

  return (
    <div className={`hud${touch ? ' is-touch' : ''}`}>
      {aiming && <div className={`hud-crosshair${prompt?.usable && !held ? ' is-focused' : ''}`} />}
      {guide && (
        <div
          key={guide.id}
          className={`hud-guide print-paper${guide.urgent ? ' is-urgent' : ''}`}
          role="status"
        >
          {richParts(guide.text).map((part, i) =>
            part.kind === 'key' ? (
              <kbd key={i}>{part.text}</kbd>
            ) : part.kind === 'em' ? (
              <em key={i}>{part.text}</em>
            ) : (
              part.text
            ),
          )}
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

// `true` marks the keys that do nothing until the flashlight is in hand.
// A key cap is the same in every language unless it is a dictionary key.
const CONTROLS: [key: string, action: Key, needsLight: boolean][] = [
  ['WASD', 'controls.move', false],
  ['E', 'controls.interact', false],
  ['F', 'controls.light', true],
  ['Q', 'controls.mode', true],
  ['R', 'controls.swap', true],
  ['controls.key.photo', 'controls.photo', false],
  ['controls.key.shoot', 'controls.shoot', false],
  ['Esc', 'controls.leave', false],
]

// Always-on key reference, bottom-left. Desktop only: on touch that corner
// is the joystick and the buttons carry their own labels.
function Controls({ hasLight }: { hasLight: boolean }) {
  const t = useT()
  const uv = useGame((s) => s.hasUv)
  const shown = CONTROLS.filter(
    ([key, , needsLight]) => (hasLight || !needsLight) && (uv || key !== 'Q'),
  )
  return (
    <dl className="hud-controls print-ink" aria-label={t('controls.label')}>
      {shown.map(([key, action]) => (
        <div key={key}>
          <dt>{key.startsWith('controls.') ? t(key as Key) : key}</dt>
          <dd>{t(action)}</dd>
        </div>
      ))}
    </dl>
  )
}

function Battery() {
  const t = useT()
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
      aria-label={t('battery.aria', {
        level: t(`battery.level.${level}`),
        spares,
        mode: t(`battery.mode.${mode}`),
      })}
    >
      <div className="hud-battery-shell">
        {[0, 1, 2].map((i) => (
          <i key={i} className={i < cells ? 'is-lit' : ''} />
        ))}
      </div>
      <span className="hud-battery-mode">{mode === 'uv' ? 'UV' : ''}</span>
      {spares > 0 && <span className="hud-battery-spares">+{spares}</span>}
      {swapping ? (
        <span className="hud-battery-text">{t('battery.swapping')}</span>
      ) : (
        weak &&
        (spares > 0 ? (
          <span className="hud-battery-text">{t(touch ? 'battery.swap.touch' : 'battery.swap')}</span>
        ) : (
          level === 'empty' && <span className="hud-battery-text">{t('battery.empty')}</span>
        ))
      )}
    </div>
  )
}

function ItemBar() {
  const t = useT()
  const items = useGame((s) => s.items)
  const { pickups } = useRoomDef()
  // Anything picked up with a note attached is paper.
  const isNote = (id: string) => pickups.some((p) => p.item === id && p.note)
  const held = Object.keys(items).filter((id) => items[id] > 0)
  if (held.length === 0) return null
  return (
    <div className="hud-items">
      {held.map((id) => (
        <button
          key={id}
          type="button"
          className="hud-item print-paper"
          aria-label={t('item.use', { item: itemLabel(id) })}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            applyItemToFocus(id)
          }}
        >
          {id.endsWith('key') ? (
            <KeyIcon />
          ) : isNote(id) ? (
            <LetterIcon />
          ) : (
            <span className="hud-item-dot" />
          )}
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

// A sheet folded in three, one corner turned.
function LetterIcon() {
  return (
    <svg viewBox="0 0 20 16" width="20" height="16" aria-hidden="true">
      <path
        d="M2 2h12l4 4v8H2zM14 2v4h4M5 7.5h7M5 10.5h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
