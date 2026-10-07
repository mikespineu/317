import { BufferAttribute, BufferGeometry, Group, Matrix4, Mesh, MeshBasicMaterial } from 'three/webgpu'
import type { InterleavedBufferAttribute, Material, Object3D, Side } from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { MIRROR_ONLY, requiredNodes } from './bindNodes'
import type { BoundRoom } from './bindNodes'
import type { RoomDef } from './roomDef'

// Scenery other systems find by name without the definition listing it.
// Everything the definition names is kept already.
const KEEP = [/^Portrait_.+_Canvas$/]

type Attribute = BufferAttribute | InterleavedBufferAttribute

// glTF extras. GLTFLoader also stores every node's own name there.
function hasData(node: Object3D) {
  return Object.keys(node.userData).some((key) => key !== 'name')
}

function mergeable(mesh: Mesh): mesh is Mesh<BufferGeometry, Material> {
  const g = mesh.geometry
  return (
    !Array.isArray(mesh.material) &&
    !('isSkinnedMesh' in mesh || 'isInstancedMesh' in mesh || 'isBatchedMesh' in mesh) &&
    g.getAttribute('position') !== undefined &&
    Object.keys(g.morphAttributes).length === 0 &&
    g.drawRange.start === 0 &&
    g.drawRange.count === Infinity
  )
}

// The attributes the bake rewrites; they always come out as floats.
const BAKED = new Set(['position', 'normal', 'tangent'])

// Meshes merge only when their vertex layouts match exactly, so a material
// used with and without UVs (or vertex colours) becomes two meshes rather
// than one with attributes dropped or invented.
function layout(geometry: BufferGeometry) {
  return Object.entries(geometry.attributes)
    .map(([name, a]) =>
      BAKED.has(name)
        ? `${name}${a.itemSize}`
        : `${name}${a.itemSize}${a.array.constructor.name}${a.normalized}`,
    )
    .sort()
    .join(',')
}

function copyAttribute(attr: Attribute, float: boolean): BufferAttribute {
  const size = attr.itemSize
  // Quantised data cannot hold world-space values: read it out as floats.
  if (float && ('isInterleavedBufferAttribute' in attr || !(attr.array instanceof Float32Array))) {
    const array = new Float32Array(attr.count * size)
    for (let i = 0; i < attr.count; i++)
      for (let c = 0; c < size; c++) array[i * size + c] = attr.getComponent(i, c)
    return new BufferAttribute(array, size)
  }
  if (!('isInterleavedBufferAttribute' in attr)) return attr.clone()
  // Out of the shared buffer, raw values and type unchanged.
  const { array: data, stride } = attr.data
  const array = new (data.constructor as new (length: number) => typeof data)(attr.count * size)
  for (let i = 0; i < attr.count; i++)
    for (let c = 0; c < size; c++) array[i * size + c] = data[i * stride + attr.offset + c]
  return new BufferAttribute(array, size, attr.normalized)
}

// A copy of the mesh's geometry with `matrix` applied, always indexed so
// indexed and plain meshes merge together.
function bake(mesh: Mesh, matrix: Matrix4, positionOnly = false) {
  const source = mesh.geometry
  const out = new BufferGeometry()
  for (const [name, attr] of Object.entries(source.attributes)) {
    if (positionOnly && name !== 'position') continue
    out.setAttribute(name, copyAttribute(attr as Attribute, BAKED.has(name)))
  }
  const count = source.getAttribute('position').count
  const index = source.index
    ? Array.from(source.index.array)
    : Array.from({ length: count }, (_, i) => i)
  // A mirrored transform turns every triangle inside out: wind them back.
  const mirrored = matrix.determinant() < 0
  if (mirrored)
    for (let i = 0; i + 2 < index.length; i += 3)
      [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]]
  out.setIndex(index)
  out.applyMatrix4(matrix)
  const tangent = out.getAttribute('tangent')
  if (mirrored && tangent)
    for (let i = 0; i < tangent.count; i++) tangent.setW(i, -tangent.getW(i))
  return out
}

function triangles(geometry: BufferGeometry) {
  return (geometry.index ?? geometry.getAttribute('position')).count / 3
}

function countMeshes(scene: Object3D) {
  let n = 0
  scene.traverse((node) => {
    if ((node as Mesh).isMesh) n++
  })
  return n
}

// A multi-material object loads as a group of meshes named Name_1, Name_2...
function ownerOf(mesh: Mesh): Object3D {
  const parent = mesh.parent
  const part =
    parent && mesh.name.startsWith(parent.name) && /^_\d+$/.test(mesh.name.slice(parent.name.length))
  return part ? parent : mesh
}

// Merges the static scenery into one mesh per material, baked into the
// scene's space, so a room of a hundred parts costs a couple of dozen draw
// calls (and the mirror, which draws the room again, half as many).
//
// Left alone, with everything below them: every node the definition names
// (interactables, pickups, props, lock meshes, intro doors, the mirror, the
// exit), KEEP, hidden nodes (mirror-only), nodes carrying glTF extras, and
// meshes that cannot be merged safely. Lone users of a material are left as
// they are too. Parents of kept nodes stay in place as transforms: a merged
// mesh that still has children is swapped for an empty group with its name.
//
// room.nodes afterwards holds only what is still in the scene (or detached by
// bindNodes): names that were merged away are removed, so a lookup of one
// fails where it is made rather than moving an object nobody draws. A node
// that some system needs by name belongs in the definition, or in KEEP.
//
// Occluders are not the merged meshes. A merged mesh spans the whole room, so
// its bounds reject no ray, and three's raycast then tests every triangle:
// in the hall about 10k static triangles land in 11 merged meshes (walnut
// alone is 5.4k, brass 2k), against a few dozen triangles per ray when each
// object has its own tight bounds. With several line-of-sight rays a frame
// that is the difference between nothing and a millisecond or more on a
// phone. So each merged-away object leaves a position-only copy in world
// space (parts of a multi-material object joined, one per material side so
// culling of back faces is unchanged), never added to the scene and never
// drawn: the rays cost what they did before the merge. Kept meshes stay in
// the list as they were, and what was not solid (Window_Glass) merges apart
// from what was and leaves no copy.
export function mergeStatic(room: BoundRoom, def: RoomDef) {
  const scene = room.scene
  scene.updateMatrixWorld(true)
  const before = countMeshes(scene)

  const keep = requiredNodes(def)
  for (const map of [room.interactables, room.pickups, room.props])
    for (const name of map.keys()) keep.add(name)

  // Parents come before their children in this list.
  const candidates: Mesh<BufferGeometry, Material>[] = []
  const walk = (node: Object3D, held: boolean) => {
    held ||=
      node !== scene &&
      (keep.has(node.name) ||
        KEEP.some((pattern) => pattern.test(node.name)) ||
        node.name.startsWith(MIRROR_ONLY) ||
        !node.visible ||
        hasData(node) ||
        // A group's render order applies to everything under it.
        ((node as Group).isGroup && node.renderOrder !== 0))
    const mesh = node as Mesh
    if (!held && mesh.isMesh && mergeable(mesh)) candidates.push(mesh)
    for (const child of node.children) walk(child, held)
  }
  walk(scene, false)

  // Whatever changes how a mesh is drawn, or whether it blocks sight, keeps it apart.
  const solid = new Set<Object3D>(room.occluders)
  const batches = new Map<string, Mesh<BufferGeometry, Material>[]>()
  for (const mesh of candidates) {
    const key = [
      mesh.material.uuid,
      mesh.castShadow,
      mesh.receiveShadow,
      mesh.frustumCulled,
      mesh.renderOrder,
      mesh.layers.mask,
      solid.has(mesh),
      layout(mesh.geometry),
    ].join('|')
    const batch = batches.get(key)
    if (batch) batch.push(mesh)
    else batches.set(key, [mesh])
  }

  const toScene = new Matrix4().copy(scene.matrixWorld).invert()
  const matrix = new Matrix4()
  const gone = new Set<Mesh>()
  const proxyParts = new Map<string, { owner: Object3D; side: Side; parts: BufferGeometry[] }>()
  let mergedMeshes = 0
  let mergedTriangles = 0

  for (const batch of batches.values()) {
    if (batch.length < 2) continue
    const first = batch[0]
    const geometry = mergeGeometries(
      batch.map((mesh) => bake(mesh, matrix.multiplyMatrices(toScene, mesh.matrixWorld))),
    )
    if (!geometry) {
      console.warn(`[room] could not merge the ${first.material.name} scenery, left as it is`)
      continue
    }
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    const merged = new Mesh(geometry, first.material)
    merged.name = `Static_${first.material.name || mergedMeshes}`
    merged.castShadow = first.castShadow
    merged.receiveShadow = first.receiveShadow
    merged.frustumCulled = first.frustumCulled
    merged.renderOrder = first.renderOrder
    merged.layers.mask = first.layers.mask
    scene.add(merged)
    mergedMeshes++
    mergedTriangles += triangles(geometry)

    for (const mesh of batch) {
      gone.add(mesh)
      if (!solid.has(mesh)) continue
      const owner = ownerOf(mesh)
      const key = `${owner.id}|${mesh.material.side}`
      let proxy = proxyParts.get(key)
      if (!proxy) proxyParts.set(key, (proxy = { owner, side: mesh.material.side, parts: [] }))
      proxy.parts.push(bake(mesh, mesh.matrixWorld, true))
    }
  }

  // Never drawn, so one plain material per side is enough for the raycaster.
  const proxyMaterials = new Map<Side, MeshBasicMaterial>()
  const proxies: Mesh[] = []
  for (const { owner, side, parts } of proxyParts.values()) {
    const geometry = mergeGeometries(parts)
    if (!geometry) continue
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    let material = proxyMaterials.get(side)
    if (!material) proxyMaterials.set(side, (material = new MeshBasicMaterial({ side })))
    const proxy = new Mesh(geometry, material)
    proxy.name = `Occluder_${owner.name}`
    proxy.matrixAutoUpdate = false // world space, and it has no parent
    proxies.push(proxy)
  }
  room.occluders = [...room.occluders.filter((mesh) => !gone.has(mesh)), ...proxies]

  // Children first, so a parent is judged by what is left under it.
  for (const mesh of [...gone].reverse()) {
    const parent = mesh.parent
    if (!parent) continue
    if (mesh.children.length > 0) {
      const stand = new Group()
      stand.name = mesh.name
      stand.position.copy(mesh.position)
      stand.quaternion.copy(mesh.quaternion)
      stand.scale.copy(mesh.scale)
      stand.userData = mesh.userData
      stand.add(...mesh.children)
      parent.add(stand)
      parent.remove(mesh)
      if (room.nodes.get(mesh.name) === mesh) room.nodes.set(mesh.name, stand)
      continue
    }
    parent.remove(mesh)
    if (room.nodes.get(mesh.name) === mesh) room.nodes.delete(mesh.name)
    // Groups that held nothing but merged parts go with them.
    for (let node = parent; node !== scene && node.children.length === 0; ) {
      const up = node.parent
      if (!up || (node.type !== 'Group' && node.type !== 'Object3D')) break
      up.remove(node)
      if (room.nodes.get(node.name) === node) room.nodes.delete(node.name)
      node = up
    }
  }
  scene.updateMatrixWorld(true)

  // The sources are done with, unless a kept mesh shares the geometry
  // (instances of one glTF mesh do). The merged geometries live as long as
  // the scene does, like the rest of the room.
  const inUse = new Set<BufferGeometry>()
  const note = (node: Object3D) => {
    const mesh = node as Mesh
    if (mesh.isMesh && !gone.has(mesh)) inUse.add(mesh.geometry)
  }
  scene.traverse(note)
  for (const node of room.nodes.values()) node.traverse(note)
  for (const mesh of gone) if (!inUse.has(mesh.geometry)) mesh.geometry.dispose()

  if (import.meta.env.DEV) {
    console.info(`[room] merged "${def.id}"`, {
      meshes: `${before} → ${countMeshes(scene)}`,
      static: `${gone.size} → ${mergedMeshes} (${mergedTriangles} triangles)`,
      occluders: `${room.occluders.length} (${proxies.length} proxies)`,
    })
  }
}
