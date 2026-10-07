import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { runtime } from '../runtime'
import { useGame } from '../store'
import { quality } from '../renderer/quality'
import { debugState } from './debugState'
import './debug.css'

const MAX_BOXES = 64
const BOX_HEIGHT = 2 // metres; colliders are XZ footprints, the height is only for show
const STATS_INTERVAL = 0.25 // seconds between readout refreshes

// The 12 edges of a box as corner-index pairs (bit 0 = x, bit 1 = y, bit 2 = z).
const EDGES = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7]

function overlayMaterial<T extends THREE.NodeMaterial>(material: T) {
  material.fog = false
  material.toneMapped = false
  material.depthTest = false // readable through furniture
  material.transparent = true
  return material
}

function buildOverlays() {
  const boxGeometry = new THREE.BufferGeometry()
  const boxPositions = new THREE.Float32BufferAttribute(MAX_BOXES * EDGES.length * 3, 3)
  boxPositions.setUsage(THREE.DynamicDrawUsage)
  boxGeometry.setAttribute('position', boxPositions)
  boxGeometry.setDrawRange(0, 0)
  const boxes = new THREE.LineSegments(
    boxGeometry,
    overlayMaterial(new THREE.LineBasicNodeMaterial({ color: '#ff5a3c' })),
  )
  boxes.name = 'Debug_Colliders'
  boxes.frustumCulled = false // positions are rewritten without recomputing bounds

  // Unit cone, apex at the origin, opening along -Z: scaled per frame.
  const coneGeometry = new THREE.ConeGeometry(1, 1, 20, 1, true)
  coneGeometry.translate(0, -0.5, 0)
  coneGeometry.rotateX(Math.PI / 2)
  const cone = new THREE.Mesh(
    coneGeometry,
    overlayMaterial(new THREE.MeshBasicNodeMaterial({ color: '#ffd76a', wireframe: true })),
  )
  cone.name = 'Debug_Beam'
  cone.frustumCulled = false

  for (const object of [boxes, cone]) {
    object.visible = false
    object.castShadow = false
    object.receiveShadow = false
    object.renderOrder = 999
    object.raycast = () => {} // never a gameplay pick target
  }
  return { boxes, boxPositions, cone }
}

const target = new THREE.Vector3()

// Dev overlays: collider boxes, the beam cone and a frame/draw-call readout.
// Only mounted with ?debug. The toggles live in debugState.
export function DebugScene() {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer
  const o = useMemo(buildOverlays, [])
  const statsEl = useRef<HTMLDivElement | null>(null)
  const acc = useRef({ time: 0, frames: 0, worst: 0 })

  useEffect(() => {
    const el = document.createElement('div')
    el.className = 'debug-stats'
    document.body.appendChild(el)
    statsEl.current = el
    return () => {
      el.remove()
      statsEl.current = null
      o.boxes.geometry.dispose()
      o.boxes.material.dispose()
      o.cone.geometry.dispose()
      o.cone.material.dispose()
    }
  }, [o])

  // Overlay geometry follows the simulation, before the frame is drawn.
  useFrame(() => {
    o.boxes.visible = debugState.showColliders
    if (debugState.showColliders) {
      const array = o.boxPositions.array as Float32Array
      const count = Math.min(runtime.colliders.length, MAX_BOXES)
      let i = 0
      for (let c = 0; c < count; c++) {
        const box = runtime.colliders[c]
        for (const corner of EDGES) {
          array[i++] = corner & 1 ? box.maxX : box.minX
          array[i++] = corner & 2 ? BOX_HEIGHT : 0.01
          array[i++] = corner & 4 ? box.maxZ : box.minZ
        }
      }
      o.boxPositions.needsUpdate = true
      o.boxes.geometry.setDrawRange(0, count * EDGES.length)
    }

    const beam = runtime.beam
    o.cone.visible = debugState.showBeam && beam.strength > 0
    if (o.cone.visible) {
      const half = Math.acos(Math.min(1, Math.max(-1, beam.cos)))
      const radius = beam.range * Math.tan(half)
      o.cone.position.copy(beam.origin)
      // lookAt turns +Z toward its target, and the cone opens along -Z.
      o.cone.lookAt(target.copy(beam.origin).sub(beam.dir))
      o.cone.scale.set(radius, radius, beam.range)
      o.cone.material.color.set(beam.mode === 'uv' ? '#b06cff' : '#ffd76a')
    }
  })

  // Read the counters after PostFx (1) and photo capture (2) have rendered.
  // three resets renderer.info once per animation frame by itself.
  useFrame((_, delta) => {
    const el = statsEl.current
    if (!el) return
    el.hidden = !debugState.showStats
    if (!debugState.showStats) return
    const a = acc.current
    a.time += delta
    a.frames++
    a.worst = Math.max(a.worst, delta)
    if (a.time < STATS_INTERVAL) return
    const { drawCalls, triangles, frameCalls } = gl.info.render
    const fps = a.frames / a.time
    el.textContent =
      `${fps.toFixed(0)} fps  ${((a.time / a.frames) * 1000).toFixed(1)} ms` +
      `  worst ${(a.worst * 1000).toFixed(0)} ms\n` +
      `${drawCalls} draws  ${Math.round(triangles).toLocaleString('en')} tris` +
      `  ${frameCalls} passes\n` +
      `${useGame.getState().backend ?? '...'}  ${quality.name}  ${gl.domElement.width}x${gl.domElement.height}`
    a.time = 0
    a.frames = 0
    a.worst = 0
  }, 3)

  return (
    <>
      <primitive object={o.boxes} />
      <primitive object={o.cone} />
    </>
  )
}
