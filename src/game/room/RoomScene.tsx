import { createContext, use, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { BoxGeometry, Group, MathUtils, Mesh, MeshStandardMaterial, PointLight } from 'three/webgpu'
import type { Object3D } from 'three/webgpu'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { runtime } from '../runtime'
import { bindNodes } from './bindNodes'
import type { BoundRoom } from './bindNodes'
import { buildGreybox } from './greybox'
import { mergeStatic } from './mergeStatic'
import type { RoomDef } from './roomDef'

const RoomContext = createContext<BoundRoom | null>(null)

// The bound room. Only valid in components rendered inside <RoomScene>.
export function useRoom(): BoundRoom {
  const room = use(RoomContext)
  if (!room) throw new Error('useRoom must be used inside <RoomScene>')
  return room
}

// Uses the room .glb when it exists and the greybox otherwise, so coding
// never waits for modelling. ?greybox forces the greybox.
async function loadScene(def: RoomDef): Promise<Object3D> {
  const scene = await loadRoomModel(def.scene)
  await addModelPickups(scene, def)
  return scene
}

async function loadRoomModel(url: string): Promise<Object3D> {
  if (new URLSearchParams(window.location.search).has('greybox')) return buildGreybox()
  try {
    return (await new GLTFLoader().loadAsync(url)).scene
  } catch (error) {
    console.warn(`[room] could not load ${url}, using the greybox`, error)
    return buildGreybox()
  }
}

// Pickups the room file does not contain: the definition names a model and a
// place, and the node is added under the pickup's name so it binds like any
// other. A model that fails to load becomes a plain box, so the room still works.
async function addModelPickups(scene: Object3D, def: RoomDef) {
  for (const p of def.pickups) {
    if (!p.model) continue
    let node: Object3D
    try {
      node = (await new GLTFLoader().loadAsync(p.model)).scene
    } catch (error) {
      console.warn(`[room] could not load ${p.model}, using a box for ${p.node}`, error)
      node = new Group().add(
        new Mesh(new BoxGeometry(0.08, 0.08, 0.25), new MeshStandardMaterial({ color: '#2a2530' })),
      )
    }
    node.name = p.node
    if (p.at) node.position.set(...p.at)
    node.rotation.y = MathUtils.degToRad(p.yawDeg ?? 0)
    if (p.glow) {
      // At the lens end. A child of the node, so it goes when the pickup does.
      const glow = new PointLight('#ffd9a0', 0.5, 1.6, 2)
      glow.position.set(0, 0.05, -0.17)
      node.add(glow)
    }
    scene.add(node)
  }
}

// Loads and binds the room, then renders it. Children mount once the room is
// ready and read it with useRoom().
export function RoomScene({ def, children }: { def: RoomDef; children?: ReactNode }) {
  const [room, setRoom] = useState<BoundRoom | null>(null)

  useEffect(() => {
    let alive = true
    loadScene(def).then((scene) => {
      if (!alive) return
      const bound = bindNodes(scene, def)
      // ?nomerge keeps every scenery mesh apart, to compare draw calls.
      if (!new URLSearchParams(window.location.search).has('nomerge')) mergeStatic(bound, def)
      runtime.colliders = [...bound.colliders]
      setRoom(bound)
    })
    return () => {
      alive = false
    }
  }, [def])

  if (!room) return null
  return (
    <RoomContext value={room}>
      <primitive object={room.scene} />
      {children}
    </RoomContext>
  )
}
