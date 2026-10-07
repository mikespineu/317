import { useFrame } from '@react-three/fiber'
import { Box3, Raycaster, Vector2, Vector3 } from 'three/webgpu'
import type { Camera, Intersection, Object3D } from 'three/webgpu'
import type { BoundRoom } from '../room/bindNodes'
import { useRoom } from '../room/RoomScene'
import { useGame } from '../store'
import { tuning } from '../tuning'
import { PICKUP, lockOwners, promptFor } from './actions'

const raycaster = new Raycaster()
const centre = new Vector2(0, 0)
const point = new Vector2()
const hits: Intersection[] = []
const box = new Box3()
const at = new Vector3()

// Raycaster does not look at .visible, so hidden pickups and the dropped
// padlock have to be filtered by hand, ancestors included.
function shown(object: Object3D) {
  for (let o: Object3D | null = object; o; o = o.parent) if (!o.visible) return false
  return true
}

function inside(object: Object3D, ancestor: Object3D) {
  for (let o = object.parent; o; o = o.parent) if (o === ancestor) return true
  return false
}

// A lock that is scenery beside its interactable (the chest's symbol lock sits
// on the body, not on the lid) stands in for it, so aiming at the lock works.
interface Targets {
  list: Object3D[]
  locks: Map<Object3D, Object3D> // lock mesh -> its interactable
}
const targetsByRoom = new WeakMap<BoundRoom, Targets>()

function targetsOf(room: BoundRoom): Targets {
  let targets = targetsByRoom.get(room)
  if (!targets) {
    targets = { list: [...room.raycastTargets], locks: new Map() }
    for (const { mesh, node } of lockOwners()) {
      const lock = room.nodes.get(mesh)
      const owner = room.interactables.get(node)
      // A lock inside its interactable (Level 0's padlock) is already covered.
      if (!lock || !owner || inside(lock, owner)) continue
      targets.locks.set(lock, owner)
      targets.list.push(lock)
    }
    targetsByRoom.set(room, targets)
  }
  return targets
}

// The nearest ancestor that is an interactable, a pickup or a throwable prop.
// Nearest matters: the key is a child of the drawer.
function ownerOf(room: BoundRoom, locks: Targets['locks'], object: Object3D): Object3D | null {
  for (let o: Object3D | null = object; o; o = o.parent) {
    if (
      room.interactables.get(o.name) === o ||
      room.pickups.get(o.name) === o ||
      room.props.get(o.name) === o
    )
      return o
    const locked = locks.get(o)
    if (locked) return locked
  }
  return null
}

// The node a ray from a screen point lands on within reach, or null. Only the
// flat list of interactables and pickups is tested, never the whole scene.
export function pick(
  room: BoundRoom,
  camera: Camera,
  ndc?: { x: number; y: number },
): string | null {
  raycaster.setFromCamera(ndc ? point.set(ndc.x, ndc.y) : centre, camera)
  raycaster.far = tuning.reach
  hits.length = 0
  const targets = targetsOf(room)
  raycaster.intersectObjects(targets.list, true, hits)

  let first: Object3D | null = null
  for (const hit of hits) {
    if (!shown(hit.object)) continue
    const owner = ownerOf(room, targets.locks, hit.object)
    if (!owner) continue
    if (!first) {
      first = owner
      // A pickup is never hiding something else worth preferring.
      if (owner.name.startsWith(PICKUP)) break
      continue
    }
    // A pickup lying inside the thing we hit first (the key in the open
    // drawer) wins, so the drawer's own walls do not shield it.
    if (owner.name.startsWith(PICKUP) && inside(owner, first)) {
      first = owner
      break
    }
  }
  hits.length = 0
  if (!first) return nearPickup(room)
  if (promptFor(first.name)) return first.name
  // Nothing left to do with the thing itself (an open drawer): aiming at it
  // is enough to reach a pickup lying inside, which is too small to hit
  // reliably on its own (the key is 10 x 4 cm).
  for (const pickup of room.pickups.values())
    if (inside(pickup, first) && shown(pickup) && promptFor(pickup.name)) return pickup.name
  return nearPickup(room)
}

// Small pickups (a key at the bottom of the chest, seen from 1.8 m) are too
// small to hit with the ray itself: the one whose centre lies closest to the
// ray, within tuning.pickupAimRadius, is taken instead.
function nearPickup(room: BoundRoom): string | null {
  const { origin, direction } = raycaster.ray
  let best: string | null = null
  let bestDist = tuning.pickupAimRadius
  for (const pickup of room.pickups.values()) {
    if (!shown(pickup) || !promptFor(pickup.name)) continue
    box.setFromObject(pickup).getCenter(at)
    const along = at.sub(origin).dot(direction)
    if (along <= 0 || along > tuning.reach) continue
    const off = Math.sqrt(Math.max(0, at.lengthSq() - along * along))
    if (off >= bestDist) continue
    bestDist = off
    best = pickup.name
  }
  return best
}

// Keeps store.focus on whatever is under the crosshair.
export function useInteractionRay() {
  const room = useRoom()
  useFrame(({ camera }) => {
    const s = useGame.getState()
    if (s.paused || s.uiLock || s.cameraRaised || s.held) {
      s.setFocus(null)
      return
    }
    s.setFocus(pick(room, camera))
  })
}
