import { Vector3 } from 'three/webgpu'
import type { Object3D } from 'three/webgpu'
import type { LightMode } from './store'
import { tuning } from './tuning'

// Per-frame shared state. These values change every frame, so they live here
// (and in TSL uniforms) rather than in the store; nothing in here triggers a
// React render. Each block has one writer, named in its comment.

export interface Aabb {
  name: string
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  minY: number // props collide in 3D; the player only uses XZ
  maxY: number
}

export type WispState = 'wander' | 'freeze' | 'flee' | 'dissolve' | 'gone'

export const runtime = {
  // Written by the input modules, consumed by PlayerController each frame.
  input: {
    moveX: 0, // strafe, -1..1 (right is positive)
    moveY: 0, // forward, -1..1
    lookDX: 0, // accumulated yaw delta in radians, reset by the controller
    lookDY: 0, // accumulated pitch delta in radians
  },

  // Written by PlayerController.
  player: {
    position: new Vector3(0, tuning.eyeHeight, 0),
    yaw: 0,
    pitch: 0,
  },

  // Written by RoomScene on load; the door action removes Collider_Door.
  colliders: [] as Aabb[],

  // Written by battery.ts.
  battery: {
    charge: tuning.startCharge, // 0..1, current pack
  },

  // Written by Flashlight each frame. `strength` is 0 when the light is off.
  beam: {
    origin: new Vector3(),
    dir: new Vector3(0, 0, -1),
    cos: Math.cos((tuning.whiteAngleDeg * Math.PI) / 180), // cosine of the half-angle
    range: tuning.whiteDistFull,
    strength: 0, // 0..1
    mode: 'white' as LightMode,
  },

  // One entry per ghost, by definition id. Each is written by its own <Wisp>,
  // which adds it on mount and removes it on unmount.
  ghosts: new Map<string, GhostRuntime>(),
}

export interface GhostRuntime {
  id: string
  object: Object3D | null // null once it has dissolved
  position: Vector3
  speed: number // m/s
  state: WispState
  exposure: number // 0..1
}

export function createGhostRuntime(id: string): GhostRuntime {
  return { id, object: null, position: new Vector3(), speed: 0, state: 'gone', exposure: 0 }
}

// The ghosts that can still be seen and photographed.
export function liveGhosts(): GhostRuntime[] {
  const live: GhostRuntime[] = []
  for (const g of runtime.ghosts.values())
    if (g.object && g.state !== 'gone' && g.state !== 'dissolve') live.push(g)
  return live
}

// Puts the per-frame state back to its starting values for a level restart.
// Colliders are rebuilt by RoomScene when the room remounts, ghosts by their
// components. `startCharge` comes from the room definition.
export function resetRuntime(startCharge = tuning.startCharge) {
  const { input, player, battery, beam } = runtime
  input.moveX = input.moveY = input.lookDX = input.lookDY = 0
  player.position.set(0, tuning.eyeHeight, 0)
  player.yaw = player.pitch = 0
  battery.charge = startCharge
  beam.strength = 0
  runtime.ghosts.clear()
}
