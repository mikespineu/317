import { createContext, use, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Object3D } from 'three/webgpu'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { runtime } from '../runtime'
import { bindNodes } from './bindNodes'
import type { BoundRoom } from './bindNodes'
import { buildGreybox } from './greybox'
import type { RoomDef } from './level0.def'

const RoomContext = createContext<BoundRoom | null>(null)

// The bound room. Only valid in components rendered inside <RoomScene>.
export function useRoom(): BoundRoom {
  const room = use(RoomContext)
  if (!room) throw new Error('useRoom must be used inside <RoomScene>')
  return room
}

// Uses the room .glb when it exists and the greybox otherwise, so coding
// never waits for modelling. ?greybox forces the greybox.
async function loadScene(url: string): Promise<Object3D> {
  if (new URLSearchParams(window.location.search).has('greybox')) return buildGreybox()
  try {
    return (await new GLTFLoader().loadAsync(url)).scene
  } catch (error) {
    console.warn(`[room] could not load ${url}, using the greybox`, error)
    return buildGreybox()
  }
}

// Loads and binds the room, then renders it. Children mount once the room is
// ready and read it with useRoom().
export function RoomScene({ def, children }: { def: RoomDef; children?: ReactNode }) {
  const [room, setRoom] = useState<BoundRoom | null>(null)

  useEffect(() => {
    let alive = true
    loadScene(def.scene).then((scene) => {
      if (!alive) return
      const bound = bindNodes(scene, def)
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
