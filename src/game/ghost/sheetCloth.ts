import { Vector3 } from 'three/webgpu'
import { tuning } from '../tuning'

// A cheap stand-in for cloth simulation: three points hang in a chain below
// the head, each pulled toward the one above by an underdamped spring. When
// the head moves they trail behind; when it stops they swing past and settle.
// The material bends the sheet through them, so the whole drape costs three
// springs on the CPU and nothing per vertex.

const NODES = 3
// Lower points are looser, so the hem swings wider and slower than the shoulders.
const LOOSENESS = [1.35, 1, 0.7]

export interface SheetCloth {
  points: Vector3[] // world positions of the chain
  velocities: Vector3[]
  offsets: Vector3[] // points relative to the head, world axes
}

export function createCloth(head: Vector3): SheetCloth {
  return {
    points: LOOSENESS.map(() => head.clone()),
    velocities: LOOSENESS.map(() => new Vector3()),
    offsets: LOOSENESS.map(() => new Vector3()),
  }
}

const _force = new Vector3()

export function stepCloth(cloth: SheetCloth, head: Vector3, dt: number) {
  // Fixed small steps keep the springs stable on a slow frame.
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)))
  const h = dt / steps
  for (let s = 0; s < steps; s++) {
    for (let i = 0; i < NODES; i++) {
      const k = tuning.sheetStiffness * LOOSENESS[i]
      const c = 2 * tuning.sheetDamping * Math.sqrt(k)
      const target = i === 0 ? head : cloth.points[i - 1]
      const point = cloth.points[i]
      const velocity = cloth.velocities[i]
      _force.subVectors(target, point).multiplyScalar(k).addScaledVector(velocity, -c)
      velocity.addScaledVector(_force, h)
      point.addScaledVector(velocity, h)
    }
  }
  // The sheet cannot stretch: cap how far each point strays from the head.
  for (let i = 0; i < NODES; i++) {
    const offset = cloth.offsets[i].subVectors(cloth.points[i], head)
    const max = (tuning.sheetMaxLag * (i + 1)) / NODES
    if (offset.length() > max) {
      offset.setLength(max)
      cloth.points[i].addVectors(head, offset)
    }
  }
}
