// Tiny tween runner. Interaction advances it in useFrame, so tweens stop with
// the game when it is paused. No animation library needed for a drawer and a door.
export type Ease = (k: number) => number

export const easeInOut: Ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
export const easeOut: Ease = (k) => 1 - Math.pow(1 - k, 3)
export const easeIn: Ease = (k) => k * k

interface Tween {
  t: number
  seconds: number
  ease: Ease
  update(k: number): void
  done?: () => void
}

const tweens: Tween[] = []

export function tween(
  seconds: number,
  update: (k: number) => void,
  done?: () => void,
  ease: Ease = easeInOut,
) {
  tweens.push({ t: 0, seconds: Math.max(seconds, 0.0001), ease, update, done })
}

export function advanceTweens(dt: number) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]
    tw.t = Math.min(tw.t + dt, tw.seconds)
    tw.update(tw.ease(tw.t / tw.seconds))
    if (tw.t >= tw.seconds) {
      tweens.splice(i, 1)
      tw.done?.()
    }
  }
}

export function clearTweens() {
  tweens.length = 0
}
