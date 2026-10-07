import { useFrame } from '@react-three/fiber'
import { Raycaster, Vector2 } from 'three/webgpu'
import type { Camera, Intersection, Object3D } from 'three/webgpu'
import type { BoundRoom } from '../room/bindNodes'
import { useRoom } from '../room/RoomScene'
import { useGame } from '../store'
import { tuning } from '../tuning'
import { PICKUP, promptFor } from './actions'

const raycaster = new Raycaster()
const centre = new Vector2(0, 0)
const point = new Vector2()
const hits: Intersection[] = []

// Raycaster does not look at .visible, so hidden pickups and the dropped
// padlock have to be filtered by hand, ancestors included.
function shown(object: Object3D) {
  for (let o: Object3D | null = object; o; o = o.parent) if (!o.visible) return false
  return true
}

// The nearest ancestor that is an interactable, a pickup or a throwable prop.
// Nearest matters: the key is a child of the drawer.
function ownerOf(room: BoundRoom, object: Object3D): Object3D | null {
  for (let o: Object3D | null = object; o; o = o.parent)
    if (
      room.interactables.get(o.name) === o ||
      room.pickups.get(o.name) === o ||
      room.props.get(o.name) === o
    )
      return o
  return null
}

function inside(object: Object3D, ancestor: Object3D) {
  for (let o = object.parent; o; o = o.parent) if (o === ancestor) return true
  return false
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
  raycaster.intersectObjects(room.raycastTargets, true, hits)

  let first: Object3D | null = null
  for (const hit of hits) {
    if (!shown(hit.object)) continue
    const owner = ownerOf(room, hit.object)
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
  if (!first) return null
  if (promptFor(first.name)) return first.name
  // Nothing left to do with the thing itself (an open drawer): aiming at it
  // is enough to reach a pickup lying inside, which is too small to hit
  // reliably on its own (the key is 10 x 4 cm).
  for (const pickup of room.pickups.values())
    if (inside(pickup, first) && shown(pickup) && promptFor(pickup.name)) return pickup.name
  return null
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
