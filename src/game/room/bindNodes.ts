import { Box3, Vector3 } from 'three/webgpu'
import type { Mesh, Object3D } from 'three/webgpu'
import type { Aabb } from '../runtime'
import type { RoomDef } from './roomDef'

export interface BoundRoom {
  scene: Object3D
  // Every named node, including detached ghosts. Static scenery that
  // mergeStatic merged away is no longer here.
  nodes: Map<string, Object3D>
  interactables: Map<string, Object3D> // Interact_*, and any node the definition lists
  pickups: Map<string, Object3D> // Pickup_*
  props: Map<string, Object3D> // throwable props named in the definition
  raycastTargets: Object3D[] // interactables + pickups + throwable props, for the interaction ray
  // Solid scenery, for line-of-sight raycasts. After mergeStatic some are
  // undrawn world-space copies of merged scenery: use them for rays only.
  occluders: Mesh[]
  colliders: Aabb[] // Collider_* as world-space XZ boxes
  spawns: Map<string, Vector3> // Spawn_* world positions
  mirror: Mesh | null
  mirrorOnly: Mesh[] // MirrorOnly_*: drawn only into the mirror's reflection
  uvOnly: Mesh[] // UVOnly_*: drawn only inside the UV cone, by UvInk
  ghosts: Map<string, Mesh> // ghost meshes by node name, taken out of the scene
}

// Floor and ceiling would cover the whole room on the XZ plane.
const SKIP_XZ = new Set(['Collider_Floor', 'Collider_Ceiling'])
export const MIRROR_ONLY = 'MirrorOnly_'
export const UV_ONLY = 'UVOnly_'
const NOT_SOLID = new Set(['Window_Glass'])

// Every node name the definition mentions.
export function requiredNodes(def: RoomDef) {
  const names = new Set<string>([def.spawn, def.exit.node])
  if (def.mirror) {
    names.add(def.mirror.node)
    if (def.mirror.clue) names.add(def.mirror.clue.node)
  }
  if (def.intro) names.add(def.intro.look)
  for (const door of def.intro?.doors ?? []) names.add(door)
  // Disabled entries are validated too, so the return visit only flips flags.
  for (const i of def.interactables) {
    names.add(i.node)
    if (i.lock) names.add(i.lock.mesh)
  }
  for (const p of def.pickups) names.add(p.node)
  for (const p of def.props) names.add(p.node)
  for (const u of def.uvText ?? []) names.add(u.node)
  for (const i of def.interactables) {
    for (const m of i.moves ?? []) {
      names.add(m.node)
      if (m.collider) names.add(m.collider)
    }
  }
  for (const g of def.ghosts) {
    names.add(g.mesh).add(g.spawn)
    if (g.drops) names.add(g.drops.pickup)
    for (const spot of g.spots ?? []) names.add(spot.spawn).add(spot.decoy).add(spot.disguise)
    for (const path of g.route ?? []) names.add(path)
  }
  if (def.emergencyPack) {
    names.add(def.emergencyPack.pickup)
    if (def.emergencyPack.spawn) names.add(def.emergencyPack.spawn)
  }
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
    mirrorOnly: [],
    uvOnly: [],
    ghosts: new Map(),
  }
  const ghostNames = new Set<string>(def.ghosts.map((g) => g.mesh))
  const interactNames = new Set<string>(def.interactables.map((i) => i.node))
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
    if (name.startsWith('Spawn_') || name.startsWith('Path_')) {
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
    if (!part && (name.startsWith('Interact_') || interactNames.has(name)))
      room.interactables.set(name, node)
    if (!part && name.startsWith('Pickup_')) room.pickups.set(name, node)
    if (!part && throwables.has(name)) room.props.set(name, node)
    if (!mesh) return

    if (name === def.mirror?.node) {
      room.mirror = mesh
      return
    }
    // Hidden and shadowless here; Mirror shows them only while the reflection renders.
    if (name.startsWith(MIRROR_ONLY)) {
      mesh.visible = false
      room.mirrorOnly.push(mesh)
      return
    }
    // Ink is a decal: no shadow, no ray, and nothing hides behind it.
    if (name.startsWith(UV_ONLY)) {
      mesh.castShadow = false
      mesh.receiveShadow = false
      mesh.raycast = () => {}
      room.uvOnly.push(mesh)
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
      mirrorOnly: room.mirrorOnly.map((m) => m.name),
      uvOnly: room.uvOnly.map((m) => m.name),
      ghosts: [...room.ghosts.keys()],
    })
  }
  return room
}
