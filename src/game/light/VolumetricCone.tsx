import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  ConeGeometry,
  DoubleSide,
  Mesh,
  MeshBasicNodeMaterial,
} from 'three/webgpu'
import type { Object3D } from 'three/webgpu'
import { dot, normalView, positionGeometry, positionViewDirection, smoothstep, uniform } from 'three/tsl'
import { runtime } from '../runtime'
import { tuning } from '../tuning'
import { beamColor, beamStrength } from './uvReveal'

// The visible shaft of light. A unit cone (apex at the origin, opening along
// -Z, radius 1 at z = -1) hung on the flashlight's aim node and scaled each
// frame to the beam's half-angle and reach.
export function VolumetricCone({ parent }: { parent: Object3D }) {
  const cone = useMemo(() => {
    const geometry = new ConeGeometry(1, 1, 40, 1, true).translate(0, -0.5, 0).rotateX(Math.PI / 2)

    const opacity = uniform(tuning.coneOpacity)
    const edgePower = uniform(tuning.coneEdgePower)
    const lengthPower = uniform(tuning.coneLengthPower)

    // 0 at the lens, 1 at the far end
    const along = positionGeometry.z.negate()
    const lengthFade = along.oneMinus().clamp().pow(lengthPower).mul(smoothstep(0, 0.05, along))
    // Fresnel-like: walls seen edge-on (the silhouette) fade out, so the cone
    // reads as a volume instead of a shell.
    const facing = dot(normalView, positionViewDirection).abs().pow(edgePower)

    const material = new MeshBasicNodeMaterial()
    material.colorNode = beamColor
    material.opacityNode = lengthFade.mul(facing).mul(beamStrength).mul(opacity)
    material.transparent = true
    material.blending = AdditiveBlending
    material.depthWrite = false
    material.side = DoubleSide // the player often looks through it from inside
    material.fog = false

    const mesh = new Mesh(geometry, material)
    mesh.name = 'Flashlight_Cone'
    mesh.frustumCulled = false
    mesh.renderOrder = 2
    mesh.raycast = () => {} // never an interaction or line-of-sight target
    return { mesh, geometry, material, opacity, edgePower, lengthPower }
  }, [])

  useEffect(() => {
    parent.add(cone.mesh)
    return () => {
      parent.remove(cone.mesh)
    }
  }, [parent, cone])

  useEffect(
    () => () => {
      cone.geometry.dispose()
      cone.material.dispose()
    },
    [cone],
  )

  useFrame(() => {
    const { cos, range, strength } = runtime.beam
    cone.mesh.visible = strength > 0
    if (!cone.mesh.visible) return
    const length = range * tuning.coneLengthFrac
    const radius = length * Math.tan(Math.acos(cos))
    cone.mesh.scale.set(radius, radius, length)
    cone.opacity.value = tuning.coneOpacity
    cone.edgePower.value = tuning.coneEdgePower
    cone.lengthPower.value = tuning.coneLengthPower
  })

  return null
}
