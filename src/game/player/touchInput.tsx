import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react'
import { emit } from '../events'
import { runtime } from '../runtime'
import { useGame } from '../store'
import { tuning } from '../tuning'
import './touch.css'

interface Touch {
  role: 'move' | 'look'
  startX: number
  startY: number
  lastX: number
  lastY: number
  startAt: number
  travel: number // furthest distance from the start, px
}

function blocked() {
  const { paused, uiLock } = useGame.getState()
  return paused || uiLock !== null
}

// Joystick on the left half, drag-to-look on the right half, taps anywhere.
// Listens on the window and only takes touches that land on the game canvas,
// so buttons and modal overlays never start a drag.
function useTouchSurface(
  base: RefObject<HTMLDivElement | null>,
  knob: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    const touches = new Map<number, Touch>()
    const has = (role: Touch['role']) => [...touches.values()].some((t) => t.role === role)

    const hideStick = () => {
      runtime.input.moveX = runtime.input.moveY = 0
      if (base.current) base.current.style.opacity = '0'
    }

    const reset = () => {
      if (has('move')) hideStick()
      touches.clear()
    }

    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      useGame.getState().setTouch(true)
      const target = e.target as Element | null
      if (target?.tagName !== 'CANVAS' || !target.closest('.game') || blocked()) return

      // One joystick and one look finger; a third finger can still tap.
      const wantsMove = e.clientX < window.innerWidth / 2
      const role: Touch['role'] = wantsMove && !has('move') ? 'move' : 'look'
      touches.set(e.pointerId, {
        role,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        startAt: performance.now(),
        travel: 0,
      })
      if (role === 'move' && base.current && knob.current) {
        const size = tuning.joystickRadiusPx * 2
        const el = base.current
        el.style.width = el.style.height = `${size}px`
        el.style.left = `${e.clientX}px`
        el.style.top = `${e.clientY}px`
        el.style.opacity = '1'
        knob.current.style.transform = 'translate(-50%, -50%)'
      }
    }

    const move = (e: PointerEvent) => {
      const t = touches.get(e.pointerId)
      if (!t) return
      if (blocked()) return reset()
      const dx = e.clientX - t.startX
      const dy = e.clientY - t.startY
      t.travel = Math.max(t.travel, Math.hypot(dx, dy))

      if (t.role === 'move') {
        const radius = tuning.joystickRadiusPx
        const len = Math.hypot(dx, dy)
        const k = len > radius ? radius / len : 1
        const x = (dx * k) / radius
        const y = (dy * k) / radius
        const live = Math.hypot(x, y) > tuning.joystickDeadzone
        runtime.input.moveX = live ? x : 0
        runtime.input.moveY = live ? -y : 0 // screen up is forward
        if (knob.current)
          knob.current.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`
      } else {
        runtime.input.lookDX += (e.clientX - t.lastX) * tuning.touchLookSensitivity
        runtime.input.lookDY += (e.clientY - t.lastY) * tuning.touchLookSensitivity
      }
      t.lastX = e.clientX
      t.lastY = e.clientY
    }

    const up = (e: PointerEvent) => {
      const t = touches.get(e.pointerId)
      if (!t) return
      touches.delete(e.pointerId)
      if (t.role === 'move') hideStick()
      if (e.type !== 'pointerup' || blocked()) return

      const quick = performance.now() - t.startAt <= tuning.tapMaxMs
      if (!quick || t.travel > tuning.tapMaxMovePx) return
      const rect = (e.target as Element).getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      emit('interact', {
        ndc: {
          x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
          y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
        },
      })
    }

    // A modal or the rotate prompt taking over drops whatever was held.
    const unsubscribe = useGame.subscribe((s, prev) => {
      if ((s.paused && !prev.paused) || (s.uiLock !== null && prev.uiLock === null)) reset()
    })

    if (window.matchMedia?.('(pointer: coarse)').matches) useGame.getState().setTouch(true)

    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      unsubscribe()
      reset()
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [base, knob])
}

function TouchButton(props: {
  label: string
  onPress: () => void
  area: string
  active?: boolean
  dim?: boolean
  tone?: 'warm' | 'uv' | 'ghost'
  badge?: number
  children: ReactNode
}) {
  // Acts on press, not on click, so there is no delay under the thumb.
  const press = (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    props.onPress()
  }
  const cls = [
    'touch-btn',
    props.active && 'is-active',
    props.dim && 'is-dim',
    props.tone && `tone-${props.tone}`,
  ]
  return (
    <button
      type="button"
      className={cls.filter(Boolean).join(' ')}
      style={{ gridArea: props.area }}
      aria-label={props.label}
      aria-pressed={props.active}
      onPointerDown={press}
    >
      {props.children}
      {props.badge !== undefined && <span className="touch-badge">{props.badge}</span>}
    </button>
  )
}

const svg = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

function Buttons() {
  const lightOn = useGame((s) => s.lightOn)
  const lightMode = useGame((s) => s.lightMode)
  const spares = useGame((s) => s.spares)
  const raised = useGame((s) => s.cameraRaised)
  const game = useGame.getState

  return (
    <div className="touch-buttons">
      <TouchButton
        label="Swap battery"
        area="battery"
        dim={spares === 0}
        badge={spares}
        onPress={() => game().swapBattery()}
      >
        <svg {...svg}>
          <rect x="3" y="8" width="16" height="8" rx="1.5" />
          <path d="M21 11v2M7 11v2M10.5 11v2" />
        </svg>
      </TouchButton>
      <TouchButton
        label={raised ? 'Lower camera' : 'Raise camera'}
        area="camera"
        tone="ghost"
        active={raised}
        onPress={() => game().setCameraRaised(!game().cameraRaised)}
      >
        <svg {...svg}>
          <path d="M4 8h3.2l1.4-2h6.8l1.4 2H20v10H4z" />
          <circle cx="12" cy="13" r="3.2" />
        </svg>
      </TouchButton>
      <TouchButton
        label={lightMode === 'uv' ? 'Switch to white light' : 'Switch to UV light'}
        area="mode"
        tone="uv"
        active={lightMode === 'uv'}
        onPress={() => game().toggleMode()}
      >
        <span className="touch-glyph">UV</span>
      </TouchButton>
      <TouchButton
        label={lightOn ? 'Light off' : 'Light on'}
        area="light"
        tone="warm"
        active={lightOn}
        onPress={() => game().toggleLight()}
      >
        <svg {...svg}>
          <path d="M3 9.5h7l4-2.5v10l-4-2.5H3z" />
          <path d="M17.5 9l3-1.5M17.5 12H21M17.5 15l3 1.5" />
        </svg>
      </TouchButton>
      {raised && (
        <TouchButton label="Take photo" area="shutter" tone="ghost" onPress={() => emit('shoot')}>
          <svg {...svg}>
            <circle cx="12" cy="12" r="8.5" />
            <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
          </svg>
        </TouchButton>
      )}
      <TouchButton label="Interact" area="interact" onPress={() => emit('interact', {})}>
        <svg {...svg}>
          <path d="M9 12V5.5a1.5 1.5 0 0 1 3 0V11" />
          <path d="M12 11V9.5a1.5 1.5 0 0 1 3 0V12" />
          <path d="M15 12v-1a1.5 1.5 0 0 1 3 0v4.5a5.5 5.5 0 0 1-5.5 5.5h-.7a5 5 0 0 1-4-2L5.6 15a1.4 1.4 0 0 1 2.2-1.7L9 14.5" />
        </svg>
      </TouchButton>
    </div>
  )
}

// DOM overlay. The surface listeners are always on, because the first touch
// is how a touch device is recognised; the visuals appear once it is.
export function TouchControls() {
  const base = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)
  useTouchSurface(base, knob)

  const touch = useGame((s) => s.touch)
  const hidden = useGame((s) => s.paused || s.uiLock !== null)
  if (!touch) return null

  return (
    <div className="touch" onContextMenu={(e) => e.preventDefault()}>
      <div ref={base} className="touch-stick">
        <div ref={knob} className="touch-knob" />
      </div>
      {!hidden && <Buttons />}
    </div>
  )
}
