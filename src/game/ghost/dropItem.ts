import { Raycaster, Vector3 } from 'three/webgpu'
import type { Color, Material, Mesh, Object3D } from 'three/webgpu'
import { sfx } from '../audio/sfx'
import { apply } from '../puzzle/chain'
import type { BoundRoom } from '../room/bindNodes'
import type { GhostDef } from '../room/roomDef'
import { useGame } from '../store'
import { tuning } from '../tuning'

// What a ghost leaves behind: its pickup falls from where the ghost dissolved,
// bounces once, then glints on the floor until it is taken. Plain data plus a
// step function, like the brain; Wisp.tsx owns it and steps it each frame.

type DropDef = NonNullable<GhostDef['drops']>
type Emissive = Material & { color: Color; emissive: Color; emissiveIntensity: number }

export interface Drop {
  def: DropDef
  node: Object3D
  home: Vector3 // the node's position in the .glb, put back on dispose
  world: Vector3 // where it is now
  restY: number
  speed: number // m/s, downward positive
  bounced: boolean
  state: 'fall' | 'glint' | 'taken'
  clock: number // seconds glinting
  swapped: { mesh: Mesh; original: Material; clone: Emissive }[]
}

const GLINT_RATE = 2.2 // rad/s: one slow pulse every three seconds or so
const DOWN = new Vector3(0, -1, 0)
const _raycaster = new Raycaster()
const _local = new Vector3()

function shown(object: Object3D) {
  for (let o: Object3D | null = object; o; o = o.parent) if (!o.visible) return false
  return true
}

function inside(object: Object3D, root: Object3D) {
  for (let o: Object3D | null = object; o; o = o.parent) if (o === root) return true
  return false
}

// The first solid thing under a point: the floor, or a table top. Hidden
// scenery and the falling item itself do not count.
function floorUnder(point: Vector3, occluders: Mesh[], self: Object3D) {
  _raycaster.set(point, DOWN)
  _raycaster.near = 0
  _raycaster.far = point.y + 1
  for (const hit of _raycaster.intersectObjects(occluders, false))
    if (shown(hit.object) && !inside(hit.object, self)) return hit.point.y
  return 0
}

function place(drop: Drop) {
  const parent = drop.node.parent
  _local.copy(drop.world)
  drop.node.position.copy(parent ? parent.worldToLocal(_local) : _local)
}

function setGlint(drop: Drop, amount: number) {
  for (const { clone } of drop.swapped) clone.emissiveIntensity = amount
}

// Starts the drop at `from` (world space), or from where the pickup already is
// when the flag was set some other way (a debug skip). Setting the flag is
// what shows the pickup and makes it usable.
export function createDrop(room: BoundRoom, def: DropDef, from: Vector3 | null): Drop | null {
  const node = room.pickups.get(def.pickup)
  if (!node) return null

  const drop: Drop = {
    def,
    node,
    home: node.position.clone(),
    world: from ? from.clone() : node.getWorldPosition(new Vector3()),
    restY: 0,
    speed: 0,
    bounced: false,
    state: 'fall',
    clock: 0,
    swapped: [],
  }
  drop.restY = floorUnder(drop.world, room.occluders, node) + tuning.keyDropRest
  if (drop.world.y <= drop.restY) {
    drop.world.y = drop.restY
    drop.state = 'glint'
  }
  place(drop)

  // The glint is emissive on the item's own copies of its materials: the .glb
  // shares materials between objects, and another light would cost a recompile.
  node.traverse((object) => {
    const mesh = object as Mesh
    const original = mesh.material as Material | Material[] | undefined
    if (!mesh.isMesh || !original || Array.isArray(original)) return
    if (!(original as Emissive).emissive?.isColor || !(original as Emissive).color?.isColor) return
    const clone = original.clone() as Emissive
    clone.emissive.copy(clone.color)
    clone.emissiveIntensity = 0
    mesh.material = clone
    drop.swapped.push({ mesh, original, clone })
  })

  apply(def.sets)
  return drop
}

export function stepDrop(drop: Drop, dt: number) {
  if (drop.state === 'taken' || dt <= 0) return
  if (useGame.getState().pickedUp[drop.def.pickup]) {
    drop.state = 'taken'
    setGlint(drop, 0)
    return
  }

  if (drop.state === 'fall') {
    drop.speed += tuning.keyDropGravity * dt
    drop.world.y -= drop.speed * dt
    if (drop.world.y <= drop.restY) {
      drop.world.y = drop.restY
      if (drop.bounced) {
        drop.state = 'glint'
      } else {
        // One small bounce; the sound belongs to the first hit.
        drop.bounced = true
        drop.speed *= -tuning.keyDropBounce
        sfx.play('keyDrop')
      }
    }
    place(drop)
    return
  }

  drop.clock += dt
  setGlint(drop, tuning.keyGlint * (0.5 - 0.5 * Math.cos(drop.clock * GLINT_RATE)))
}

// Puts the pickup back as the .glb had it, for a level restart.
export function disposeDrop(drop: Drop) {
  for (const { mesh, original, clone } of drop.swapped) {
    // Restore only if nobody replaced the material in the meantime.
    if (mesh.material === clone) mesh.material = original
    clone.dispose()
  }
  drop.swapped.length = 0
  drop.node.position.copy(drop.home)
}
