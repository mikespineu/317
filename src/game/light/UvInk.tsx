import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Box3, MeshBasicNodeMaterial, Vector3 } from 'three/webgpu'
import type { CanvasTexture, Mesh, Object3D } from 'three/webgpu'
import { texture, uniform, uv, vec2, vec3 } from 'three/tsl'
import { tr } from '#/i18n'
import { sfx } from '../audio/sfx'
import { blocked } from '../ghost/wispBrain'
import { useRoomDef } from '../room/RoomContext'
import { useRoom } from '../room/RoomScene'
import { runtime } from '../runtime'
import { useGame } from '../store'
import { tuning } from '../tuning'
import { makeInkTexture } from './uvInkArt'
import { uvMask, uvMaskAt } from './uvReveal'

interface Ink {
  mesh: Mesh
  gives: string | undefined
  held: number // seconds the ink has been continuously lit
  centre: Vector3
}

function firstMesh(node: Object3D | undefined) {
  let found: Mesh | null = null
  node?.traverse((child) => {
    if (!found && (child as Mesh).isMesh) found = child as Mesh
  })
  return found as Mesh | null
}

const _box = new Box3()

// Swaps each UVOnly_ plane's material for one that draws its picture only
// inside the UV cone, and logs the plane's clue once the lamp has rested on it
// for a moment. A plane that is a child of a throwable book moves with it, so
// the ink still reads (and counts) wherever the book lands.
export function UvInk() {
  const room = useRoom()
  const def = useRoomDef()
  const inks = useRef<Ink[]>([])
  const glow = useRef(uniform(tuning.revealGlow))

  useEffect(() => {
    const entries = def.uvText ?? []
    const made: { material: MeshBasicNodeMaterial; map: CanvasTexture; mesh: Mesh; original: Mesh['material'] }[] = []
    const list: Ink[] = []
    const ink = vec3(0.75, 0.55, 1.0) // violet-white, as the painting's

    for (const entry of entries) {
      const mesh = firstMesh(room.nodes.get(entry.node))
      if (!mesh) continue
      const map = makeInkTexture(entry, entry.text ? tr(entry.text) : '')
      const at = entry.flip ? vec2(uv().x.oneMinus(), uv().y) : uv()
      const amount = texture(map, at).r.mul(uvMask()).clamp()

      const material = new MeshBasicNodeMaterial()
      material.name = `UvInk_${entry.node}`
      material.colorNode = ink.mul(glow.current)
      material.opacityNode = amount
      material.transparent = true
      material.depthWrite = false
      material.fog = false
      material.polygonOffset = true
      material.polygonOffsetFactor = -2
      material.polygonOffsetUnits = -2
      // Under the digit that sits inside a handprint, 3 mm in front of it.
      mesh.renderOrder = entry.art === 'digit' ? 4 : 3
      made.push({ material, map, mesh, original: mesh.material })
      mesh.material = material
      mesh.visible = false

      mesh.geometry.computeBoundingBox()
      list.push({ mesh, gives: entry.gives, held: 0, centre: new Vector3() })
    }
    inks.current = list

    return () => {
      inks.current = []
      for (const { material, map, mesh, original } of made) {
        mesh.material = original
        material.dispose()
        map.dispose()
      }
    }
  }, [room, def])

  useFrame((_, delta) => {
    glow.current.value = tuning.revealGlow
    const beam = runtime.beam
    const on = beam.mode === 'uv' && beam.strength > 0
    for (const ink of inks.current) ink.mesh.visible = on

    const store = useGame.getState()
    if (!on || store.paused || store.uiLock !== null) return
    const dt = Math.min(delta, tuning.maxFrameDt)
    for (const ink of inks.current) {
      const clue = ink.gives?.replace(/^clue:/, '')
      if (!clue || store.clues.includes(clue)) continue

      // The plane's middle in the world, followed as the book it sits on moves.
      ink.mesh.updateWorldMatrix(true, false)
      _box.copy(ink.mesh.geometry.boundingBox!).getCenter(ink.centre).applyMatrix4(ink.mesh.matrixWorld)
      const lit =
        uvMaskAt(ink.centre) >= tuning.clueMaskThreshold &&
        !blocked(beam.origin, ink.centre, room.occluders)
      ink.held = lit ? ink.held + dt : 0
      if (ink.held >= tuning.uvInkHoldSeconds) {
        store.addClue(clue)
        sfx.play('chime')
      }
    }
  })

  return null
}
