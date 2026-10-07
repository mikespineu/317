import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Group, PointLight, Vector3 } from 'three/webgpu'
import { sfx } from '../audio/sfx'
import { on } from '../events'
import { useRoom } from '../room/RoomScene'
import { level0 } from '../room/level0.def'
import { runtime } from '../runtime'
import type { WispState } from '../runtime'
import { useGame } from '../store'
import { tuning } from '../tuning'
import { createCloth, stepCloth } from './sheetCloth'
import type { SheetCloth } from './sheetCloth'
import { createBrain, startDissolve, stepBrain } from './wispBrain'
import type { WispBrain } from './wispBrain'
import { createWispMaterial } from './wispMaterial'
import type { WispMaterial } from './wispMaterial'

const LIGHT_COLOR = 0x8fffd6
const LIGHT_DISTANCE = 3.5
const UP = new Vector3(0, 1, 0)
const _local = new Vector3()

interface Live {
  brain: WispBrain
  cloth: SheetCloth
  yaw: number // the eyes (+Z of the mesh) turn toward the player
  group: Group
  light: PointLight
  look: WispMaterial
  whisper: number // last gain sent to the audio, -1 = off
}

// runtime.wisp holds one ghost, so Level 0 drives the first wisp in the definition.
const def = level0.ghosts.find((g) => g.type === 'wisp')

export function Wisp() {
  const room = useRoom()
  const scene = useThree((s) => s.scene)
  const live = useRef<Live | null>(null)

  useEffect(() => {
    if (!def) return
    const mesh = room.ghosts.get(def.mesh)
    const spawn = room.spawns.get(def.spawn)
    if (!mesh || !spawn) return

    const look = createWispMaterial()
    const original = mesh.material
    mesh.material = look.material
    mesh.position.set(0, 0, 0) // the group carries the position
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.frustumCulled = false // the cloth moves outside the mesh's bounds
    mesh.renderOrder = 10

    // The light stays in the scene after the Wisp is gone (at zero intensity):
    // removing a light makes every lit material recompile.
    const light = new PointLight(LIGHT_COLOR, 0, LIGHT_DISTANCE, 2)
    light.castShadow = false
    const group = new Group()
    group.name = 'Wisp_Root'
    group.add(mesh, light)
    group.position.copy(spawn)
    scene.add(group)

    const brain = createBrain(spawn)
    live.current = { brain, cloth: createCloth(spawn), yaw: 0, group, light, look, whisper: -1 }
    runtime.wisp.object = mesh
    runtime.wisp.position.copy(spawn)
    runtime.wisp.speed = 0
    runtime.wisp.exposure = 0
    runtime.wisp.state = brain.state

    const off = on('photo', ({ ghostId, quality }) => {
      if (ghostId !== def.id || quality === null) return
      if (brain.state !== 'freeze' || quality < tuning.photoDissolveQuality) return
      startDissolve(brain)
      sfx.play('wispDissolve')
    })

    return () => {
      off()
      live.current = null
      sfx.loop('wispWhisper', false)
      group.removeFromParent()
      mesh.removeFromParent()
      mesh.material = original
      look.material.dispose()
      runtime.wisp.object = null
      runtime.wisp.state = 'gone'
      runtime.wisp.speed = 0
      runtime.wisp.exposure = 0
    }
  }, [room, scene])

  useFrame((_, delta) => {
    const w = live.current
    if (!w) return
    const { brain, cloth, group, light, look } = w
    const game = useGame.getState()
    if (game.paused || game.uiLock || brain.state === 'gone') return

    const dt = Math.min(delta, tuning.maxFrameDt)
    stepBrain(brain, dt, {
      beam: runtime.beam,
      player: runtime.player.position,
      occluders: room.occluders,
    })

    group.position.copy(brain.position).add(brain.offset)

    // Turn to face the player, taking the short way round.
    const player = runtime.player.position
    const want = Math.atan2(player.x - group.position.x, player.z - group.position.z)
    const turn = Math.atan2(Math.sin(want - w.yaw), Math.cos(want - w.yaw))
    w.yaw += turn * Math.min(1, tuning.sheetTurnRate * dt)
    group.rotation.y = w.yaw

    // The cloth trails the head. The springs run in world space; the material
    // wants the result in the mesh's own (turned) space.
    stepCloth(cloth, group.position, dt)
    const u = look.uniforms
    const lags = [u.lag1, u.lag2, u.lag3]
    for (let i = 0; i < lags.length; i++)
      lags[i].value.copy(_local.copy(cloth.offsets[i]).applyAxisAngle(UP, -w.yaw))
    // Sinking lifts the hem and fills the skirt; rising pulls it in.
    const fill = Math.max(-0.12, Math.min(0.35, cloth.offsets[2].y * tuning.sheetBillow))
    u.billow.value = fill + 0.025 * Math.sin(u.time.value * 1.6)
    u.flutter.value =
      tuning.sheetFlutter * (1 + brain.speed * tuning.sheetFlutterSpeed) +
      (brain.state === 'freeze' ? tuning.sheetFreezeShiver : 0)
    u.opacity.value = tuning.sheetOpacity
    u.foldDepth.value = tuning.sheetFoldDepth
    u.press.value = tuning.sheetPress
    // The arms float a little, and go up when it is caught in the light.
    u.armReach.value = tuning.sheetArmReach
    u.armLift.value =
      tuning.sheetArmLift * (1 + 0.12 * Math.sin(u.time.value * 1.9) + 0.35 * brain.exposure)
    u.time.value += dt
    u.exposure.value = brain.exposure
    u.dissolve.value = brain.dissolve
    u.glow.value = tuning.wispGlow
    u.exposureGlow.value = tuning.wispExposureGlow
    light.intensity = tuning.wispLight * (1 + brain.exposure) * (1 - brain.dissolve)

    runtime.wisp.position.copy(group.position)
    runtime.wisp.speed = brain.speed
    runtime.wisp.exposure = brain.exposure
    runtime.wisp.state = brain.state

    // stepBrain may have finished the dissolve.
    if ((brain.state as WispState) === 'gone') {
      runtime.wisp.object?.removeFromParent()
      runtime.wisp.object = null
      runtime.wisp.speed = 0
      light.intensity = 0
      sfx.loop('wispWhisper', false)
      w.whisper = -1
      return
    }

    // Whisper: louder as the player gets close. Sent only when it changes.
    const dist = group.position.distanceTo(runtime.player.position)
    const near = Math.max(0, 1 - dist / Math.max(0.1, tuning.wispWhisperDist))
    const gain = brain.state === 'dissolve' ? 0 : near * near
    if (Math.abs(gain - w.whisper) > 0.02) {
      w.whisper = gain
      sfx.loop('wispWhisper', gain > 0, gain)
    }
  })

  return null
}
