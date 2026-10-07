import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
} from 'three/webgpu'
import type { BufferGeometry } from 'three/webgpu'

// Temporary stand-in for level-0.glb: boxes with the same names, sizes and
// pivots as the Blender spec, so the code runs before (or without) the export.

const materials = new Map<string, MeshStandardMaterial>()
function mat(color: string) {
  let m = materials.get(color)
  if (!m) materials.set(color, (m = new MeshStandardMaterial({ color, roughness: 0.9 })))
  return m
}

type V3 = [number, number, number]

function add(parent: Object3D, name: string, geometry: BufferGeometry, pos: V3, color: string) {
  const mesh = new Mesh(geometry, mat(color))
  mesh.name = name
  mesh.position.set(...pos)
  parent.add(mesh)
  return mesh
}

// A box centred on its origin.
function box(parent: Object3D, name: string, size: V3, pos: V3, color = '#77706a') {
  return add(parent, name, new BoxGeometry(...size), pos, color)
}

// A box whose origin is offset from its centre (door hinge, drawer back).
function pivotBox(parent: Object3D, name: string, size: V3, offset: V3, pos: V3, color: string) {
  return add(parent, name, new BoxGeometry(...size).translate(...offset), pos, color)
}

// glTF UVs run top to bottom; three's own planes run bottom to top.
function flipV(geometry: BufferGeometry) {
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i))
  return geometry
}

function empty(parent: Object3D, name: string, pos: V3) {
  const node = new Object3D()
  node.name = name
  node.position.set(...pos)
  parent.add(node)
}

export function buildGreybox(): Group {
  const room = new Group()
  room.name = 'Greybox'
  const wall = '#6f6a63'
  const wood = '#5a4636'

  // Shell: 4.0 x 5.0 m, 2.8 m ceiling, floor centre at the origin.
  box(room, 'Floor', [4, 0.1, 5], [0, -0.05, 0], '#5b5148')
  box(room, 'Ceiling', [4, 0.1, 5], [0, 2.85, 0], wall)
  box(room, 'Wall_N', [4.3, 2.8, 0.15], [0, 1.4, -2.575], wall)
  box(room, 'Wall_E', [0.15, 2.8, 5], [2.075, 1.4, 0], wall)
  box(room, 'Wall_W', [0.15, 2.8, 5], [-2.075, 1.4, 0], wall)
  // South wall, split around the 1.0 m door opening.
  box(room, 'Wall_S_W', [1.65, 2.8, 0.15], [-1.325, 1.4, 2.575], wall)
  box(room, 'Wall_S_E', [1.65, 2.8, 0.15], [1.325, 1.4, 2.575], wall)
  box(room, 'Wall_S_Top', [1, 0.6, 0.15], [0, 2.5, 2.575], wall)

  // Furniture.
  box(room, 'Desk', [1.4, 0.78, 0.7], [0, 0.39, -2.11], wood)
  box(room, 'Chair', [0.5, 0.95, 0.5], [0, 0.475, -1.5], wood)
  box(room, 'Bookshelf', [0.35, 2, 1], [1.795, 1, 1.7], wood)
  box(room, 'Rug', [2, 0.02, 1.4], [0, 0.01, 0.5], '#4d3a4f')

  // Mirror (west wall) and painting (east wall) face each other.
  const mirrorFrame = box(room, 'Mirror_Frame', [0.05, 1.1, 0.7], [-1.975, 1.5, 0], wood)
  add(
    mirrorFrame,
    'Mirror_Surface',
    new PlaneGeometry(0.56, 0.96).rotateY(Math.PI / 2),
    [0.03, 0, 0],
    '#9aa3ad',
  )
  const paintingFrame = box(room, 'Painting_Frame', [0.05, 1, 0.8], [1.975, 1.5, 0], wood)
  add(
    paintingFrame,
    'Interact_Painting_Canvas',
    flipV(new PlaneGeometry(0.66, 0.86).rotateY(-Math.PI / 2)),
    [-0.03, 0, 0],
    '#b9ad92',
  )

  // Door: origin on the hinge edge at floor level; the leaf extends along +X.
  const door = pivotBox(
    room,
    'Interact_Door',
    [1, 2.2, 0.06],
    [0.5, 1.1, 0],
    [-0.5, 0, 2.575],
    '#4a5a5c',
  )
  box(door, 'Door_Handle', [0.08, 0.08, 0.14], [0.88, 1.05, 0], '#b08d4a')
  box(door, 'Collider_Door', [1, 2.2, 0.06], [0.5, 1.1, 0])

  // Drawer: origin at the back centre; it slides out along +Z.
  const drawer = pivotBox(
    room,
    'Interact_Desk_Drawer',
    [0.6, 0.14, 0.5],
    [0, 0, 0.25],
    [0, 0.65, -2.28],
    '#6b5440',
  )
  box(drawer, 'Desk_Padlock', [0.1, 0.08, 0.04], [0, -0.03, 0.53], '#b08d4a')
  box(drawer, 'Pickup_Key', [0.1, 0.01, 0.04], [0.05, -0.046, 0.25], '#d6b25e')

  box(room, 'Pickup_Battery', [0.03, 0.06, 0.1], [1.91, 1.01, 2.01], '#3f6f5f')
  box(room, 'Pickup_Battery_Desk', [0.1, 0.06, 0.03], [0.45, 0.81, -1.91], '#3f6f5f')

  // Wisp: origin at the centre of the head.
  add(room, 'Wisp', new SphereGeometry(0.15, 16, 12), [-0.5, 1.5, 0.3], '#bff5e0')

  // Colliders.
  box(room, 'Collider_Floor', [4, 0.1, 5], [0, -0.05, 0])
  box(room, 'Collider_Ceiling', [4, 0.1, 5], [0, 2.85, 0])
  box(room, 'Collider_Wall_N', [4.3, 2.8, 0.15], [0, 1.4, -2.575])
  box(room, 'Collider_Wall_E', [0.15, 2.8, 5], [2.075, 1.4, 0])
  box(room, 'Collider_Wall_W', [0.15, 2.8, 5], [-2.075, 1.4, 0])
  box(room, 'Collider_Wall_S_W', [1.65, 2.8, 0.15], [-1.325, 1.4, 2.575])
  box(room, 'Collider_Wall_S_E', [1.65, 2.8, 0.15], [1.325, 1.4, 2.575])
  box(room, 'Collider_Desk', [1.4, 0.78, 0.7], [0, 0.39, -2.11])
  box(room, 'Collider_Chair', [0.5, 0.95, 0.5], [0, 0.475, -1.5])
  box(room, 'Collider_Bookshelf', [0.35, 2, 1], [1.795, 1, 1.7])

  empty(room, 'Spawn_Player', [0, 0, 1.8])
  empty(room, 'Spawn_Wisp', [-0.5, 1.5, 0.3])

  return room
}
