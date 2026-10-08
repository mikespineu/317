import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useT } from '#/i18n'
import { sfx } from '../audio/sfx'
import { lockCode, tryCode } from '../interaction/actions'
import { useHud } from '../interaction/hudState'
import { useGame } from '../store'
import { tuning } from '../tuning'
import './padlock.css'

// Wheels keep their digits between visits, like a real padlock.
const remembered = new Map<string, number[]>()

const wrap = (n: number) => ((n % 10) + 10) % 10

// The combination padlock overlay. It only sets uiLock; the input module
// releases and restores pointer lock from that.
export function PadlockUI() {
  const open = useGame((s) => s.uiLock === 'padlock')
  const node = useHud((s) => s.lockNode)
  if (!open || !node) return null
  return <Padlock node={node} />
}

function Padlock({ node }: { node: string }) {
  const t = useT()
  const touch = useGame((s) => s.touch)
  const [digits, setDigits] = useState(
    () => remembered.get(node) ?? lockCode(node).map(() => 0),
  )
  const [selected, setSelected] = useState(0)
  const [shake, setShake] = useState(false)

  const step = (index: number, delta: number) => {
    sfx.play('wheelClick')
    setSelected(index)
    setDigits((d) => {
      const next = d.map((v, i) => (i === index ? wrap(v + delta) : v))
      remembered.set(node, next)
      return next
    })
  }
  const close = () => useGame.getState().setUiLock(null)
  const confirm = () => {
    if (tryCode(node, digits)) return // the action closes the UI
    sfx.play('locked')
    setShake(true)
  }

  // Latest handlers for the one key listener below.
  const keys = useRef({ step, confirm, selected, count: digits.length })
  keys.current = { step, confirm, selected, count: digits.length }

  useEffect(() => {
    // Capture phase on window: the game's own key bindings never see these.
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation()
      const k = keys.current
      if (e.key === 'ArrowLeft') setSelected((k.selected + k.count - 1) % k.count)
      else if (e.key === 'ArrowRight') setSelected((k.selected + 1) % k.count)
      else if (e.key === 'ArrowUp') k.step(k.selected, 1)
      else if (e.key === 'ArrowDown') k.step(k.selected, -1)
      else if (e.key === 'Enter') k.confirm()
      else if (e.key === 'Escape') close()
      else if (/^[0-9]$/.test(e.key)) {
        // Typing a digit sets the wheel and moves on.
        k.step(k.selected, Number(e.key) - (remembered.get(node)?.[k.selected] ?? 0))
        setSelected(Math.min(k.selected + 1, k.count - 1))
      } else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [node])

  return (
    <div className="padlock-overlay" role="dialog" aria-modal="true" aria-label={t('lock.padlock')}>
      <div
        className={`padlock${shake ? ' is-wrong' : ''}`}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) setShake(false)
        }}
      >
        <div className="padlock-shackle" />
        <div className="padlock-body">
          <div className="padlock-wheels">
            {digits.map((digit, i) => (
              <Wheel
                key={i}
                index={i}
                digit={digit}
                selected={i === selected}
                onStep={(delta) => step(i, delta)}
              />
            ))}
          </div>
          <div className="padlock-actions">
            <button type="button" className="padlock-btn" onClick={close}>
              {t('lock.leave')}
            </button>
            <button type="button" className="padlock-btn is-primary" onClick={confirm}>
              {t('lock.try')}
            </button>
          </div>
        </div>
      </div>
      {!touch && (
        <p className="padlock-hint">
          <kbd>←</kbd> <kbd>→</kbd> {t('lock.hint.wheel')} &nbsp; <kbd>↑</kbd> <kbd>↓</kbd>{' '}
          {t('lock.hint.turn')} &nbsp; <kbd>Enter</kbd> {t('lock.hint.try')} &nbsp; <kbd>Esc</kbd>{' '}
          {t('lock.hint.leave')}
        </p>
      )}
    </div>
  )
}

function Wheel({
  index,
  digit,
  selected,
  onStep,
}: {
  index: number
  digit: number
  selected: boolean
  onStep(delta: number): void
}) {
  const t = useT()
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
    // Dragging up rolls the next digit in from below.
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
        aria-label={t('lock.wheelUp', { n: index + 1 })}
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
        <div className="wheel-strip" ref={strip}>
          <span>{wrap(digit - 1)}</span>
          <span className="is-current">{digit}</span>
          <span>{wrap(digit + 1)}</span>
        </div>
      </div>
      <button
        type="button"
        className="wheel-arrow is-down"
        aria-label={t('lock.wheelDown', { n: index + 1 })}
        onClick={() => onStep(-1)}
      />
    </div>
  )
}
