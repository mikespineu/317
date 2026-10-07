import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three/webgpu'
import { float, smoothstep, uniform, uv } from 'three/tsl'
import { tuning } from '../tuning'

// The window on the north wall (-Z) and where the moon sits behind it. These
// are geometry, not balance, so they stay here rather than in tuning.
const WINDOW = { x: 0, y: 1.6, z: -2.58, w: 1.06, h: 1.06 }
const MOON_POSITION = new THREE.Vector3(-1.1, 4.4, -6.2) // shines toward the origin
const PATCH_Y = 0.012 // just above the floor, clear of z-fighting

// The window's outline projected along the moonlight onto the floor. A
// shadowless directional light cannot draw this patch by itself.
function buildPatchGeometry() {
  const dir = MOON_POSITION.clone().negate().normalize()
  const corners: [number, number, number, number][] = [
    [-0.5, -0.5, 0, 0],
    [0.5, -0.5, 1, 0],
    [0.5, 0.5, 1, 1],
    [-0.5, 0.5, 0, 1],
  ]
  const positions: number[] = []
  const uvs: number[] = []
  for (const [cx, cy, u, v] of corners) {
    const x = WINDOW.x + cx * WINDOW.w
    const y = WINDOW.y + cy * WINDOW.h
    const t = (PATCH_Y - y) / dir.y
    positions.push(x + dir.x * t, PATCH_Y, WINDOW.z + dir.z * t)
    uvs.push(u, v)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  // The lower window edge lands nearer the wall, so this winding faces up.
  geometry.setIndex([0, 2, 1, 0, 3, 2])
  return geometry
}

function buildAtmosphere() {
  const background = new THREE.Color(tuning.backgroundColor)
  const fog = new THREE.FogExp2(tuning.fogColor, tuning.fogDensity)

  const moon = new THREE.DirectionalLight(tuning.moonColor, tuning.moonIntensity)
  moon.position.copy(MOON_POSITION)
  moon.castShadow = false

  const ambient = new THREE.AmbientLight(tuning.ambientColor, tuning.ambientIntensity)

  // Soft-edged pane with a faint cross where the glazing bars block the light.
  const patchColor = uniform(new THREE.Color(tuning.moonColor))
  const patchOpacity = uniform(tuning.moonPatchOpacity)
  const st = uv()
  const edge = smoothstep(0, 0.16, st.x)
    .mul(smoothstep(0, 0.16, st.x.oneMinus()))
    .mul(smoothstep(0, 0.16, st.y))
    .mul(smoothstep(0, 0.16, st.y.oneMinus()))
  const barX = smoothstep(0.0, 0.05, st.x.sub(0.5).abs())
  const barY = smoothstep(0.0, 0.05, st.y.sub(0.5).abs())
  const bars = float(0.45).add(barX.mul(barY).mul(0.55))

  const material = new THREE.MeshBasicNodeMaterial()
  material.colorNode = patchColor.mul(edge).mul(bars).mul(patchOpacity)
  material.blending = THREE.AdditiveBlending
  material.transparent = true
  material.depthWrite = false
  material.fog = false
  material.side = THREE.DoubleSide

  const patch = new THREE.Mesh(buildPatchGeometry(), material)
  patch.name = 'Moon_Patch'
  patch.renderOrder = 1
  patch.castShadow = false
  patch.receiveShadow = false
  patch.raycast = () => {} // decoration only, never a pick target

  return { background, fog, moon, ambient, patch, patchColor, patchOpacity }
}

// Background, moonlight, ambient and fog. Mounted outside RoomScene, so it
// must not depend on the loaded room.
export function Atmosphere() {
  const a = useMemo(buildAtmosphere, [])

  useEffect(
    () => () => {
      a.patch.geometry.dispose()
      a.patch.material.dispose()
    },
    [a],
  )

  // The debug panel edits tuning live, so copy the values across every frame.
  useFrame(() => {
    a.background.set(tuning.backgroundColor)
    a.fog.color.set(tuning.fogColor)
    a.fog.density = tuning.fogDensity
    a.moon.color.set(tuning.moonColor)
    a.moon.intensity = tuning.moonIntensity
    a.ambient.color.set(tuning.ambientColor)
    a.ambient.intensity = tuning.ambientIntensity
    a.patchColor.value.set(tuning.moonColor)
    a.patchOpacity.value = tuning.moonPatchOpacity
    a.patch.visible = tuning.moonPatchOpacity > 0
  })

  return (
    <>
      <primitive object={a.background} attach="background" />
      <primitive object={a.fog} attach="fog" />
      <primitive object={a.moon} />
      <primitive object={a.ambient} />
      <primitive object={a.patch} />
    </>
  )
}
