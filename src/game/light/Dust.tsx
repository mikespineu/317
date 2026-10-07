import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  InstancedBufferAttribute,
  Sprite,
  SpriteNodeMaterial,
} from 'three/webgpu'
import { cos, instancedBufferAttribute, mod, sin, uniform, uv, vec3 } from 'three/tsl'
import { quality } from '../renderer/quality'
import { useRoom } from '../room/RoomScene'
import { useGame } from '../store'
import { tuning } from '../tuning'
import { beamColor, beamCos, beamDir, beamPos, beamRange, beamStrength, coneMask } from './uvReveal'

const ROOM_HEIGHT = 2.8 // metres; the colliders only give the XZ extent

// Dust motes filling the room, visible only where the beam passes through
// them. WebGPU point primitives are always 1 px, so this is one Sprite drawn
// `count` times with per-instance home positions; that gives soft, sized
// motes on both backends. All the motion is in the vertex shader.
export function Dust() {
  const room = useRoom()

  const dust = useMemo(() => {
    const count = quality.dust

    // XZ extent of the room from its colliders (walls included, close enough)
    let minX = -2
    let maxX = 2
    let minZ = -2.5
    let maxZ = 2.5
    if (room.colliders.length > 0) {
      minX = Math.min(...room.colliders.map((c) => c.minX))
      maxX = Math.max(...room.colliders.map((c) => c.maxX))
      minZ = Math.min(...room.colliders.map((c) => c.minZ))
      maxZ = Math.max(...room.colliders.map((c) => c.maxZ))
    }

    const homes = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      homes[i * 3] = minX + Math.random() * (maxX - minX)
      homes[i * 3 + 1] = Math.random() * ROOM_HEIGHT
      homes[i * 3 + 2] = minZ + Math.random() * (maxZ - minZ)
      seeds[i] = Math.random()
    }
    const home = instancedBufferAttribute(new InstancedBufferAttribute(homes, 3), 'vec3' as const)
    const seed = instancedBufferAttribute(new InstancedBufferAttribute(seeds, 1), 'float' as const)

    const time = uniform(0) // our own clock, so the dust stops with the game
    const size = uniform(tuning.dustSize)
    const opacity = uniform(tuning.dustOpacity)
    const drift = uniform(tuning.dustDrift)
    const fall = uniform(tuning.dustFall)

    // Each mote wanders around its home and sinks slowly, wrapping at the floor.
    const phase = seed.mul(6.2832)
    const wander = vec3(
      sin(time.add(phase)),
      sin(time.mul(0.7).add(phase.mul(1.7))),
      cos(time.mul(1.3).add(phase.mul(2.3))),
    ).mul(drift)
    const y = mod(home.y.sub(time.mul(fall).mul(seed.add(0.5))), ROOM_HEIGHT)
    const position = vec3(home.x, y, home.z).add(wander)

    // The sprite sits at the world origin unscaled, so this is a world position.
    const lit = coneMask(position.toVarying(), beamPos, beamDir, beamCos, beamRange).mul(beamStrength)
    const disc = uv().sub(0.5).length().mul(2).oneMinus().clamp()

    const material = new SpriteNodeMaterial()
    material.positionNode = position
    material.scaleNode = size.mul(seed.mul(0.8).add(0.6))
    material.colorNode = beamColor
    material.opacityNode = disc.mul(disc).mul(lit).mul(opacity)
    material.transparent = true
    material.blending = AdditiveBlending
    material.depthWrite = false
    material.fog = false

    const sprite = new Sprite(material)
    sprite.name = 'Dust'
    sprite.count = count
    sprite.frustumCulled = false // the instances are spread over the whole room
    sprite.renderOrder = 3
    sprite.raycast = () => {}
    return { sprite, material, time, size, opacity, drift, fall }
  }, [room])

  useEffect(() => () => dust.material.dispose(), [dust])

  useFrame((_, delta) => {
    const s = useGame.getState()
    if (!s.paused && s.uiLock === null) dust.time.value += delta * tuning.dustSpeed
    dust.size.value = tuning.dustSize
    dust.opacity.value = tuning.dustOpacity
    dust.drift.value = tuning.dustDrift
    // fall is metres per second, but the clock above runs at dustSpeed
    dust.fall.value = tuning.dustFall / Math.max(tuning.dustSpeed, 1e-3)
  })

  if (quality.dust <= 0) return null
  return <primitive object={dust.sprite} />
}
