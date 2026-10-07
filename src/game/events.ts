// One-shot game events that are not state: input intents and moments other
// systems react to. State belongs in the store, per-frame values in runtime.
export interface GameEvents {
  // E, left click, the Interact button, or a tap on the canvas (ndc = tap point).
  interact: { ndc?: { x: number; y: number } }
  // Left click or the Shutter button while the camera is raised.
  shoot: undefined
  // Fired by the camera after a shot was scored, before the photo card shows.
  photo: { ghostId: string | null; quality: number | null }
}

type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void

const handlers: { [K in keyof GameEvents]?: Set<Handler<K>> } = {}

export function on<K extends keyof GameEvents>(name: K, fn: Handler<K>) {
  const set = (handlers[name] ??= new Set() as never) as Set<Handler<K>>
  set.add(fn)
  return () => {
    set.delete(fn)
  }
}

export function emit<K extends keyof GameEvents>(
  name: K,
  ...payload: GameEvents[K] extends undefined ? [] : [GameEvents[K]]
) {
  const set = handlers[name] as Set<Handler<K>> | undefined
  set?.forEach((fn) => fn(payload[0] as GameEvents[K]))
}
