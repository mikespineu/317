import { useEffect } from 'react'
import { Color } from 'three/webgpu'
import type { Material, Mesh, Object3D } from 'three/webgpu'
import { useRoom } from '../room/RoomScene'
import { useGame } from '../store'
import { tuning } from '../tuning'
import type { BoundRoom } from '../room/bindNodes'
import { promptFor } from './actions'

type Emissive = Material & { emissive: Color; emissiveIntensity: number }

const TINT = new Color('#ffd9a0')
const lift = new Color()
// One highlighted clone per source material. Several meshes share a material
// in the .glb, so the original is never touched; meshes are switched to the
// clone while focused and switched back after.
const clones = new WeakMap<Material, Emissive>()

function hasEmissive(material: Material | Material[]): material is Emissive {
  return !Array.isArray(material) && (material as Emissive).emissive?.isColor === true
}

function highlighted(source: Emissive): Emissive {
  let clone = clones.get(source)
  if (!clone) {
    clone = source.clone() as Emissive
    clones.set(source, clone)
  }
  // Folded into the colour so a source with zero intensity still lifts.
  clone.emissive
    .copy(source.emissive)
    .multiplyScalar(source.emissiveIntensity)
    .add(lift.copy(TINT).multiplyScalar(tuning.highlightLift))
  clone.emissiveIntensity = 1
  return clone
}

// The node's own meshes: nested pickups and interactables are separate things.
function ownMeshes(room: BoundRoom, node: Object3D, out: Mesh[] = []) {
  if ((node as Mesh).isMesh) out.push(node as Mesh)
  for (const child of node.children) {
    if (room.interactables.has(child.name) || room.pickups.has(child.name)) continue
    ownMeshes(room, child, out)
  }
  return out
}

// Lifts the emissive of whatever is focused and can be used.
export function Highlight() {
  const room = useRoom()
  const focus = useGame((s) => s.focus)

  useEffect(() => {
    const node = focus ? room.nodes.get(focus) : null
    if (!node || !promptFor(focus)?.usable) return
    const swapped: { mesh: Mesh; original: Material; clone: Material }[] = []
    for (const mesh of ownMeshes(room, node)) {
      // Read at highlight time: other systems replace materials after mount,
      // and node materials without a plain emissive colour are left alone.
      const original = mesh.material
      if (!hasEmissive(original)) continue
      const clone = highlighted(original)
      mesh.material = clone
      swapped.push({ mesh, original, clone })
    }
    return () => {
      // Restore only if nobody replaced the material in the meantime.
      for (const { mesh, original, clone } of swapped)
        if (mesh.material === clone) mesh.material = original
    }
  }, [focus, room])

  return null
}
