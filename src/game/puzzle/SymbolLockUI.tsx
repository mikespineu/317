import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { sfx } from '../audio/sfx'
import { lockSymbols, trySymbols } from '../interaction/actions'
import { useHud } from '../interaction/hudState'
import { useRoomDef } from '../room/RoomContext'
import { useGame } from '../store'
import { tuning } from '../tuning'
import { SYMBOLS, SYMBOL_BOX } from './symbols'
import './padlock.css'
import './symbol-lock.css'

// Wheels keep their symbols between visits, like the padlock's digits.
const remembered = new Map<string, number[]>()

// How long the solved wheels stay on screen before the lock drops, in ms.
const SOLVED_HOLD_MS = 320

// The symbol lock overlay: the padlock's wheels with icons instead of digits.
// It only sets uiLock; the input module releases and restores pointer lock.
export function SymbolLockUI() {
  const open = useGame((s) => s.uiLock === 'symbol-lock')
  const node = useHud((s) => s.lockNode)
  const lock = useRoomDef().interactables.find((i) => i.node === node)?.lock
  if (!open || !node || lock?.type !== 'symbol') return null
  return <SymbolLock node={node} wheels={lock.wheels} />
}

function SymbolLock({ node, wheels }: { node: string; wheels: readonly string[] }) {
  const touch = useGame((s) => s.touch)
  const [turns, setTurns] = useState(() => {
    const code = lockSymbols(node)
    // Every wheel starts on a symbol the answer does not use, so none is given away.
    const start = Math.max(0, wheels.findIndex((id) => !code.includes(id)))
    return remembered.get(node) ?? code.map(() => start)
  })
  const [selected, setSelected] = useState(0)
  const [solved, setSolved] = useState(false)

  const count = wheels.length
  const wrap = (n: number) => ((n % count) + count) % count

  const step = (index: number, delta: number) => {
    if (solved) return
    sfx.play('symbolClick')
    setSelected(index)
    const next = turns.map((v, i) => (i === index ? wrap(v + delta) : v))
    remembered.set(node, next)
    setTurns(next)
    // No confirm button: the lock gives as soon as the wheels are right.
    const code = lockSymbols(node)
    if (next.every((v, i) => wheels[v] === code[i])) setSolved(true)
  }
  // Once solved the lock is on its way off; there is nothing left to leave.
  const close = () => {
    if (!solved) useGame.getState().setUiLock(null)
  }

  // A beat to see the last wheel land; the action then closes the UI.
  useEffect(() => {
    if (!solved) return
    const timer = window.setTimeout(() => {
      remembered.delete(node) // a restarted level must not open on the answer
      trySymbols(
        node,
        turns.map((v) => wheels[v]),
      )
    }, SOLVED_HOLD_MS)
    return () => window.clearTimeout(timer)
    // `turns` cannot change once solved, so `solved` is the only dependency.
  }, [solved])

  // Latest handlers for the one key listener below.
  const keys = useRef({ step, close, selected, wheels: turns.length })
  keys.current = { step, close, selected, wheels: turns.length }

  useEffect(() => {
    // Capture phase on window: the game's own key bindings never see these.
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation()
      const k = keys.current
      if (e.key === 'ArrowLeft') setSelected((k.selected + k.wheels - 1) % k.wheels)
      else if (e.key === 'ArrowRight') setSelected((k.selected + 1) % k.wheels)
      else if (e.key === 'ArrowUp') k.step(k.selected, 1)
      else if (e.key === 'ArrowDown') k.step(k.selected, -1)
      else if (e.key === 'Escape') k.close()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return (
    <div className="padlock-overlay" role="dialog" aria-modal="true" aria-label="Symbol lock">
      <div className={`symbol-lock${solved ? ' is-open' : ''}`}>
        <div className="symbol-lock-plate">
          <div className="padlock-wheels">
            {turns.map((turn, i) => (
              <Wheel
                key={i}
                index={i}
                above={wheels[wrap(turn - 1)]}
                current={wheels[turn]}
                below={wheels[wrap(turn + 1)]}
                selected={i === selected}
                onStep={(delta) => step(i, delta)}
              />
            ))}
          </div>
          <div className="padlock-actions">
            <button type="button" className="padlock-btn" onClick={close}>
              Leave
            </button>
          </div>
        </div>
      </div>
      {!touch && (
        <p className="padlock-hint">
          <kbd>←</kbd> <kbd>→</kbd> wheel &nbsp; <kbd>↑</kbd> <kbd>↓</kbd> turn &nbsp;{' '}
          <kbd>Esc</kbd> leave
        </p>
      )}
    </div>
  )
}

function Icon({ id, current }: { id: string; current?: boolean }) {
  return (
    <svg
      className={current ? 'is-current' : undefined}
      viewBox={`0 0 ${SYMBOL_BOX} ${SYMBOL_BOX}`}
      role={current ? 'img' : undefined}
      aria-label={current ? (SYMBOLS[id]?.label ?? id) : undefined}
      aria-hidden={current ? undefined : true}
    >
      <path d={SYMBOLS[id]?.path} fill="currentColor" fillRule="evenodd" />
    </svg>
  )
}

function Wheel({
  index,
  above,
  current,
  below,
  selected,
  onStep,
}: {
  index: number
  above: string
  current: string
  below: string
  selected: boolean
  onStep(delta: number): void
}) {
  const strip = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; y: number } | null>(null)

  const nudge = (px: number) => {
    if (strip.current) strip.current.style.transform = px ? `translateY(${px}px)` : ''
  }
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, y: e.clientY }
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const stepPx = tuning.wheelStepPx
    let dy = e.clientY - d.y
    // Dragging up rolls the next symbol in from below.
    while (Math.abs(dy) >= stepPx) {
      const dir = Math.sign(dy)
      onStep(-dir)
      d.y += dir * stepPx
      dy -= dir * stepPx
    }
    nudge(dy * 0.5)
  }
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return
    drag.current = null
    nudge(0)
  }

  return (
    <div className={`wheel${selected ? ' is-selected' : ''}`}>
      <button
        type="button"
        className="wheel-arrow is-up"
        aria-label={`Wheel ${index + 1} up`}
        onClick={() => onStep(1)}
      />
      <div
        className="wheel-window"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={(e) => onStep(e.deltaY > 0 ? 1 : -1)}
      >
        <div className="wheel-strip symbol-strip" ref={strip}>
          <Icon id={above} />
          <Icon id={current} current />
          <Icon id={below} />
        </div>
      </div>
      <button
        type="button"
        className="wheel-arrow is-down"
        aria-label={`Wheel ${index + 1} down`}
        onClick={() => onStep(-1)}
      />
    </div>
  )
}
