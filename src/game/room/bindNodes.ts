import { Box3, Vector3 } from 'three/webgpu'
import type { Mesh, Object3D } from 'three/webgpu'
import type { Aabb } from '../runtime'
import type { RoomDef } from './level0.def'

export interface BoundRoom {
  scene: Object3D
  nodes: Map<string, Object3D> // every named node, including detached ghosts
  interactables: Map<string, Object3D> // Interact_*
  pickups: Map<string, Object3D> // Pickup_*
  props: Map<string, Object3D> // throwable props named in the definition
  raycastTargets: Object3D[] // interactables + pickups + throwable props, for the interaction ray
  occluders: Mesh[] // solid scenery, for line-of-sight raycasts
  colliders: Aabb[] // Collider_* as world-space XZ boxes
  spawns: Map<string, Vector3> // Spawn_* world positions
  mirror: Mesh | null
  ghosts: Map<string, Mesh> // ghost meshes by node name, taken out of the scene
}

// Floor and ceiling would cover the whole room on the XZ plane.
const SKIP_XZ = new Set(['Collider_Floor', 'Collider_Ceiling'])
const NOT_SOLID = new Set(['Window_Glass'])

function requiredNodes(def: RoomDef) {
  const names = new Set<string>([def.spawn, def.mirror.node, def.exit.node])
  for (const i of def.interactables) {
    names.add(i.node)
    if ('lock' in i) names.add(i.lock.mesh)
  }
  for (const p of def.pickups) names.add(p.node)
  for (const p of def.props) names.add(p.node)
  for (const g of def.ghosts) names.add(g.mesh).add(g.spawn)
  return names
}

// Sorts the loaded scene's nodes by name prefix and checks them against the
// room definition. Names are the contract with Blender: a missing node throws
// in dev rather than failing quietly later.
export function bindNodes(scene: Object3D, def: RoomDef): BoundRoom {
  scene.updateMatrixWorld(true)

  const room: BoundRoom = {
    scene,
    nodes: new Map(),
    interactables: new Map(),
    pickups: new Map(),
    props: new Map(),
    raycastTargets: [],
    occluders: [],
    colliders: [],
    spawns: new Map(),
    mirror: null,
    ghosts: new Map(),
  }
  const ghostNames = new Set<string>(def.ghosts.map((g) => g.mesh))
  const throwables = new Set<string>(def.props.filter((p) => p.throwable).map((p) => p.node))
  const detach: Object3D[] = []
  const box = new Box3()

  scene.traverse((node) => {
    const name = node.name
    if (!name) return
    room.nodes.set(name, node)
    const mesh = (node as Mesh).isMesh ? (node as Mesh) : null

    if (name.startsWith('Collider_')) {
      if (!SKIP_XZ.has(name)) {
        box.setFromObject(node)
        room.colliders.push({
          name,
          minX: box.min.x,
          maxX: box.max.x,
          minZ: box.min.z,
          maxZ: box.max.z,
          minY: box.min.y,
          maxY: box.max.y,
        })
      }
      detach.push(node)
      return
    }
    if (name.startsWith('Spawn_')) {
      room.spawns.set(name, node.getWorldPosition(new Vector3()))
      return
    }
    if (ghostNames.has(name) && mesh) {
      room.ghosts.set(name, mesh)
      detach.push(node)
      return
    }

    // A multi-material object loads as a group whose meshes are named
    // Name_1, Name_2...: those are parts of the node, not nodes of their own.
    const parentName = node.parent?.name ?? ''
    const part = name.startsWith(parentName) && /^_\d+$/.test(name.slice(parentName.length))
    if (!part && name.startsWith('Interact_')) room.interactables.set(name, node)
    if (!part && name.startsWith('Pickup_')) room.pickups.set(name, node)
    if (!part && throwables.has(name)) room.props.set(name, node)
    if (!mesh) return

    if (name === def.mirror.node) {
      room.mirror = mesh
      return
    }
    mesh.castShadow = true
    mesh.receiveShadow = true
    if (!NOT_SOLID.has(name)) room.occluders.push(mesh)
  })

  // Colliders are never rendered or raycast; ghosts are driven by their own component.
  for (const node of detach) node.removeFromParent()
  room.raycastTargets = [
    ...room.interactables.values(),
    ...room.pickups.values(),
    ...room.props.values(),
  ]

  const missing = [...requiredNodes(def)].filter((name) => !room.nodes.has(name))
  if (missing.length > 0) {
    const message =
      `Room "${def.id}" is missing nodes: ${missing.join(', ')}.\n` +
      `Found: ${[...room.nodes.keys()].sort().join(', ')}`
    if (import.meta.env.DEV) throw new Error(message)
    console.error(message)
  }
  if (import.meta.env.DEV) {
    console.info(`[room] bound "${def.id}"`, {
      interactables: [...room.interactables.keys()],
      pickups: [...room.pickups.keys()],
      props: [...room.props.keys()],
      colliders: room.colliders.map((c) => c.name),
      spawns: [...room.spawns.keys()],
      mirror: room.mirror?.name ?? null,
      ghosts: [...room.ghosts.keys()],
    })
  }
  return room
}
