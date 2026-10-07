import { emit } from '../events'
import { runtime } from '../runtime'
import { useGame } from '../store'
import type { UiLock } from '../store'
import { tuning } from '../tuning'

// Keyboard, mouse and pointer lock. This module also owns `paused`, because
// on desktop it is simply "the pointer is not locked"; the rotate prompt
// feeds the portrait half in through setPortrait().

// Elements carrying this attribute lock the pointer when clicked, the same
// as the canvas does (the "click to play" overlay uses it).
export const LOCK_TARGET_ATTR = 'data-lock-target'

const MOVE_KEYS: Record<string, [x: number, y: number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
}

// Touch taps are followed by synthetic mouse events; those must not lock.
const TOUCH_MOUSE_GAP_MS = 800
// How long a re-lock may take before the game counts as paused.
const RELOCK_GRACE_MS = 400

const held = new Set<string>()
let canvas: HTMLCanvasElement | null = null
let locked = false
let relocking = false
let relockTimer = 0
let portrait = false
let lastTouchAt = -Infinity

// The intro holds the UI lock but is not a modal: the pointer stays locked
// and the player can look around while the doors slam.
const modal = (lock: UiLock) => lock !== null && lock !== 'intro'

export function syncPaused() {
  const { touch, uiLock, setPaused } = useGame.getState()
  // Touch has no pointer lock, so there only the rotate prompt pauses.
  const unlocked = !touch && !locked && !relocking && !modal(uiLock)
  setPaused(portrait || unlocked)
}

export function setPortrait(value: boolean) {
  portrait = value
  syncPaused()
}

function writeMove() {
  let x = 0
  let y = 0
  for (const code of held) {
    x += MOVE_KEYS[code][0]
    y += MOVE_KEYS[code][1]
  }
  runtime.input.moveX = Math.sign(x)
  runtime.input.moveY = Math.sign(y)
}

function releaseKeys() {
  if (held.size === 0) return
  held.clear()
  writeMove()
}

function endRelock() {
  relocking = false
  window.clearTimeout(relockTimer)
  syncPaused()
}

// Never throws: without a user gesture the browser may refuse, and then the
// "click to resume" overlay takes over.
function requestLock() {
  if (!canvas || locked) return
  relocking = true
  window.clearTimeout(relockTimer)
  relockTimer = window.setTimeout(endRelock, RELOCK_GRACE_MS)
  try {
    const result = canvas.requestPointerLock() as unknown as Promise<void> | undefined
    result?.catch?.(endRelock)
  } catch {
    endRelock()
  }
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

function playing() {
  const { paused, uiLock } = useGame.getState()
  return locked && !paused && !modal(uiLock)
}

function onKeyDown(e: KeyboardEvent) {
  const game = useGame.getState()
  if (game.uiLock !== null || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
  if (e.code in MOVE_KEYS) {
    held.add(e.code)
    writeMove()
    if (locked) e.preventDefault() // arrows must not scroll
    return
  }
  if (game.paused) return
  if (e.code === 'Tab' && locked) e.preventDefault() // keep focus on the game
  if (e.repeat) return
  if (e.code === 'KeyF') game.toggleLight()
  else if (e.code === 'KeyQ') game.toggleMode()
  else if (e.code === 'KeyR') game.swapBattery()
  else if (e.code === 'KeyE') emit('interact', {})
  else if (e.code === 'KeyP') game.setCameraRaised(!game.cameraRaised) // photo mode on / off
}

// Key-ups are always heard, so a key released behind a modal doesn't stick.
function onKeyUp(e: KeyboardEvent) {
  if (held.delete(e.code)) writeMove()
}

function onMouseDown(e: MouseEvent) {
  if (performance.now() - lastTouchAt < TOUCH_MOUSE_GAP_MS) return
  const game = useGame.getState()
  if (!locked) {
    // The click that takes the lock is spent on that; it never interacts.
    const target = e.target as Element | null
    const lockable = target === canvas || !!target?.closest?.(`[${LOCK_TARGET_ATTR}]`)
    if (e.button === 0 && lockable && game.uiLock === null && !portrait) requestLock()
    return
  }
  if (!playing() || game.uiLock !== null) return // the intro allows looking, nothing else
  if (e.button === 0) {
    if (game.cameraRaised) emit('shoot')
    else emit('interact', {})
  } else if (e.button === 2) {
    game.setCameraRaised(tuning.cameraRaiseToggle ? !game.cameraRaised : true)
  }
}

function onMouseUp(e: MouseEvent) {
  if (e.button !== 2 || tuning.cameraRaiseToggle) return
  if (performance.now() - lastTouchAt < TOUCH_MOUSE_GAP_MS) return
  const game = useGame.getState()
  if (game.cameraRaised) game.setCameraRaised(false)
}

function onMouseMove(e: MouseEvent) {
  if (!playing()) return
  runtime.input.lookDX += e.movementX * tuning.mouseSensitivity
  runtime.input.lookDY += e.movementY * tuning.mouseSensitivity
}

function onContextMenu(e: MouseEvent) {
  const target = e.target as Element | null
  if (locked || target === canvas || target?.closest?.('.game')) e.preventDefault()
}

function onLockChange() {
  const was = locked
  locked = !!canvas && document.pointerLockElement === canvas
  if (was && !locked) {
    releaseKeys()
    // Losing the lock with no modal open is Esc (or alt-tab). The browser takes
    // Esc for itself and the page never sees the key, so this is the only
    // place to leave photo mode with it. The game pauses as well; the camera
    // is already down when the player resumes. A modal's own unlock is not
    // this: uiLock is set by then, and the camera stays up behind it.
    const game = useGame.getState()
    if (game.cameraRaised && game.uiLock === null) game.setCameraRaised(false)
  }
  endRelock()
}

function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'touch') lastTouchAt = performance.now()
}

function onTouchEnd() {
  lastTouchAt = performance.now()
}

// `root` is the .game element. Returns the uninstall function.
export function installDesktopInput(root: HTMLElement) {
  canvas = root.querySelector('canvas')
  locked = !!canvas && document.pointerLockElement === canvas
  syncPaused()

  let relockAfterUi = false
  const unsubscribe = useGame.subscribe((s, prev) => {
    if (s.uiLock !== prev.uiLock) {
      if (modal(s.uiLock) && !modal(prev.uiLock)) {
        // A modal needs the cursor. This is not a pause.
        relockAfterUi = locked
        releaseKeys()
        if (locked) document.exitPointerLock()
      } else if (!modal(s.uiLock) && relockAfterUi) {
        relockAfterUi = false
        requestLock()
      }
      syncPaused()
    } else if (s.touch !== prev.touch) {
      syncPaused()
    }
  })

  const doc = document
  doc.addEventListener('keydown', onKeyDown)
  doc.addEventListener('keyup', onKeyUp)
  doc.addEventListener('mousedown', onMouseDown)
  doc.addEventListener('mouseup', onMouseUp)
  doc.addEventListener('mousemove', onMouseMove)
  doc.addEventListener('contextmenu', onContextMenu)
  doc.addEventListener('pointerlockchange', onLockChange)
  doc.addEventListener('pointerlockerror', endRelock)
  doc.addEventListener('pointerdown', onPointerDown, true)
  doc.addEventListener('touchend', onTouchEnd, true)
  window.addEventListener('blur', releaseKeys)

  return () => {
    unsubscribe()
    doc.removeEventListener('keydown', onKeyDown)
    doc.removeEventListener('keyup', onKeyUp)
    doc.removeEventListener('mousedown', onMouseDown)
    doc.removeEventListener('mouseup', onMouseUp)
    doc.removeEventListener('mousemove', onMouseMove)
    doc.removeEventListener('contextmenu', onContextMenu)
    doc.removeEventListener('pointerlockchange', onLockChange)
    doc.removeEventListener('pointerlockerror', endRelock)
    doc.removeEventListener('pointerdown', onPointerDown, true)
    doc.removeEventListener('touchend', onTouchEnd, true)
    window.removeEventListener('blur', releaseKeys)
    window.clearTimeout(relockTimer)
    relocking = false
    if (locked) document.exitPointerLock()
    locked = false
    releaseKeys()
    canvas = null
  }
}
