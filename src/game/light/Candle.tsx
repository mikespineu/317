import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  Box3,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  PointLight,
  SphereGeometry,
  Vector3,
} from 'three/webgpu'
import { mix, positionLocal, uniform, vec3 } from 'three/tsl'
import { CANDLE_FLAG } from '../interaction/actions'
import { useRoom } from '../room/RoomScene'
import type { BoundRoom } from '../room/bindNodes'
import { useRoomDef } from '../room/RoomContext'
import type { RoomDef } from '../room/roomDef'
import { useGame } from '../store'
import { tuning } from '../tuning'

const FLAME_SCALE = new Vector3(0.008, 0.014, 0.008) // a slightly fat flame, in keeping with the style
const FADE_RATE = 9 // 1/s

// A teardrop: a sphere pinched to a point at the top, with its base at y = 0.
function flameGeometry() {
  const geometry = new SphereGeometry(1, 14, 10)
  const position = geometry.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i)
    const t = (y + 1) / 2
    const pinch = 1 - 0.85 * t * t
    position.setX(i, position.getX(i) * pinch)
    position.setZ(i, position.getZ(i) * pinch)
    position.setY(i, y + 1)
  }
  geometry.computeVertexNormals()
  return geometry
}

// Cheap smooth noise in 0..1 from a few detuned sines.
function noise(t: number, seed: number) {
  return (
    0.5 +
    0.25 * Math.sin(t * 11 + seed) +
    0.15 * Math.sin(t * 23.7 + seed * 1.7) +
    0.1 * Math.sin(t * 41 + seed * 0.3)
  )
}

interface Flame {
  group: Group
  mesh: Mesh
  light: PointLight | null // one per candle holder, on its first flame
  seed: number
  level: number // 0 out .. 1 lit, eased so it grows and dies rather than snaps
}

function buildFlames(def: RoomDef, room: BoundRoom, geometry: SphereGeometry, material: MeshBasicNodeMaterial) {
  const flames: Flame[] = []
  const box = new Box3()
  def.interactables.forEach((entry, index) => {
    if (entry.type !== 'candle') return
    const node = room.nodes.get(entry.node)
    if (!node) return
    // The flame stands on the wick: the definition's wick positions, or the
    // top of the candle's box.
    node.updateWorldMatrix(true, false)
    box.setFromObject(node)
    const wicks = entry.flames?.map((at) => node.localToWorld(new Vector3(...at))) ?? [
      new Vector3((box.min.x + box.max.x) / 2, box.max.y - 0.004, (box.min.z + box.max.z) / 2),
    ]
    wicks.forEach((wick, i) => {
      const group = new Group()
      group.position.copy(wick)

      const mesh = new Mesh(geometry, material)
      mesh.scale.copy(FLAME_SCALE)
      mesh.raycast = () => {} // the candle is the target, not its flame
      mesh.renderOrder = 2
      group.add(mesh)

      // One light per holder, however many flames. Always in the scene and
      // switched off through intensity: toggling a light's visibility would
      // rebuild every lit material and hitch.
      let light: PointLight | null = null
      if (i === Math.floor(wicks.length / 2)) {
        light = new PointLight('#ffb45a', 0, tuning.candleDistance, 2)
        light.position.set(0, 0.035, 0)
        group.add(light)
      }
      room.scene.add(group)
      flames.push({ group, mesh, light, seed: index * 7.3 + i * 2.9, level: 0 })
    })
  })
  return flames
}

// Lit candles: a flickering flame and a warm point light, driven by the
// candle flag the interaction sets. Out of the box the flame is bright enough
// to catch the bloom.
export function Candle() {
  const room = useRoom()
  const def = useRoomDef()
  const geometry = useMemo(flameGeometry, [])
  const { material, uniforms } = useMemo(() => {
    const level = uniform(0)
    const material = new MeshBasicNodeMaterial()
    // Pale yellow at the heart, orange towards the tip; above 1 so bloom takes it.
    const t = positionLocal.y.div(2).clamp(0, 1)
    material.colorNode = mix(vec3(1.0, 0.92, 0.6), vec3(1.0, 0.42, 0.08), t.pow(1.5)).mul(2.2)
    material.opacityNode = level
    material.transparent = true
    material.depthWrite = false
    material.blending = AdditiveBlending
    material.fog = false
    return { material, uniforms: { level } }
  }, [])

  const flames = useMemo(
    () => buildFlames(def, room, geometry, material),
    [def, room, geometry, material],
  )

  useEffect(
    () => () => {
      for (const f of flames) {
        f.light?.dispose()
        f.group.removeFromParent()
      }
      geometry.dispose()
      material.dispose()
    },
    [flames, geometry, material],
  )

  useFrame((state, dt) => {
    const lit = !!useGame.getState().flags[CANDLE_FLAG]
    const t = state.clock.elapsedTime
    const k = 1 - Math.exp(-FADE_RATE * Math.min(dt, tuning.maxFrameDt))
    for (const f of flames) {
      f.level += ((lit ? 1 : 0) - f.level) * k
      const n = noise(t, f.seed)
      const sway = noise(t * 0.7, f.seed + 3) - 0.5
      f.mesh.visible = f.level > 0.01
      f.mesh.scale.set(
        FLAME_SCALE.x * (0.92 + 0.16 * n),
        FLAME_SCALE.y * (0.75 + 0.5 * n) * (0.4 + 0.6 * f.level),
        FLAME_SCALE.z * (0.92 + 0.16 * n),
      )
      f.mesh.rotation.set(sway * 0.3, 0, sway * 0.4)
      if (f.light) {
        f.light.intensity = f.level * tuning.candleLight * (0.8 + 0.4 * n)
        f.light.distance = tuning.candleDistance
      }
    }
    uniforms.level.value = flames.reduce((m, f) => Math.max(m, f.level), 0)
  })

  return null
}
