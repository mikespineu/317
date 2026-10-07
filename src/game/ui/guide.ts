import { useEffect, useState } from 'react'
import { check, checkAny } from '../puzzle/chain'
import { useRoomDef } from '../room/RoomContext'
import type { GuideStep, RoomDef } from '../room/roomDef'
import { useGame } from '../store'
import { tuning } from '../tuning'

// The standing instruction for what to do next: one label at a time, or none.
export interface GuideLabel {
  id: string // changes when the instruction does, so the label re-enters
  text: string // **X** marks a key cap, *x* italics
  urgent?: boolean
}

const TICK_MS = 200

// Keeping the light powered comes before anything the room wants to teach.
// These stay code: they are the same in every room.
function batteryLabel(touch: boolean): GuideLabel | null | undefined {
  const s = useGame.getState()
  if (!s.hasLight) return undefined
  const weak = s.batteryLevel === 'low' || s.batteryLevel === 'empty'
  if (!weak) return undefined
  if (s.swapping) return null
  const state = s.batteryLevel === 'empty' ? 'Battery dead.' : 'Battery low.'
  if (s.spares > 0) {
    return {
      id: 'swap',
      urgent: true,
      text: touch
        ? `${state} Tap the battery button to charge with your spare.`
        : `${state} Press **R** to charge it with your spare pack.`,
    }
  }
  return {
    id: 'find-pack',
    urgent: true,
    text: touch
      ? `${state} Find a battery pack, then tap the battery button.`
      : `${state} Find a battery pack, then press **R** to charge it.`,
  }
}

function delayOf(step: GuideStep) {
  const live = step.delayKey ? (tuning as unknown as Record<string, unknown>)[step.delayKey] : null
  return typeof live === 'number' ? live : step.delay
}

// Seconds of play each step's conditions have held without a break. A step
// keeps counting while a step above it is the one being shown.
function createGuide(def: RoomDef) {
  const held = new Map<string, number>()
  let epoch = useGame.getState().epoch

  return function evaluate(dt: number): GuideLabel | null {
    const s = useGame.getState()
    if (s.epoch !== epoch) {
      epoch = s.epoch
      held.clear() // the level was reset
    }
    // Time under a modal or the pause card is not time spent looking around.
    const playing = !s.paused && !s.uiLock
    let due: GuideStep | null = null
    for (const step of def.guide) {
      if (!check(step.when) || checkAny(step.unless)) {
        held.delete(step.id)
        continue
      }
      const time = (held.get(step.id) ?? 0) + (playing ? dt : 0)
      held.set(step.id, time)
      if (!due && time >= delayOf(step)) due = step
    }

    const battery = batteryLabel(s.touch)
    if (battery !== undefined) return battery
    if (!due) return null
    return { id: due.id, text: (s.touch && due.touchText) || due.text }
  }
}

// The label to show now. Re-evaluated on a slow tick (delays, and the ghost
// states that live in runtime) and at once on every store change.
export function useGuide(): GuideLabel | null {
  const def = useRoomDef()
  const [label, setLabel] = useState<GuideLabel | null>(null)

  useEffect(() => {
    const evaluate = createGuide(def)
    let last = performance.now()
    const update = () => {
      const now = performance.now()
      const next = evaluate((now - last) / 1000)
      last = now
      setLabel((prev) =>
        prev?.id === next?.id && prev?.text === next?.text && prev?.urgent === next?.urgent
          ? prev
          : next,
      )
    }
    update()
    const timer = window.setInterval(update, TICK_MS)
    const unsubscribe = useGame.subscribe(update)
    return () => {
      window.clearInterval(timer)
      unsubscribe()
    }
  }, [def])

  return label
}

export type RichPart = { kind: 'text' | 'key' | 'em'; text: string }

// Splits '**E**' key caps and '*italics*' out of a guide text.
export function richParts(text: string): RichPart[] {
  const parts: RichPart[] = []
  for (const piece of text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)) {
    if (!piece) continue
    if (piece.startsWith('**')) parts.push({ kind: 'key', text: piece.slice(2, -2) })
    else if (piece.startsWith('*')) parts.push({ kind: 'em', text: piece.slice(1, -1) })
    else parts.push({ kind: 'text', text: piece })
  }
  return parts
}
