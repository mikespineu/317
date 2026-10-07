// A tiny emitter between CameraMode (inside the Canvas) and CameraOverlay
// (DOM): the shutter fired, flash now and show the cooldown.
type FlashListener = (cooldownSeconds: number) => void

const listeners = new Set<FlashListener>()

export function onFlash(fn: FlashListener) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function flash(cooldownSeconds: number) {
  listeners.forEach((fn) => fn(cooldownSeconds))
}
