import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Box3, Group, PointLight, Quaternion, Vector3 } from 'three/webgpu'
import type { Object3D } from 'three/webgpu'
import { sfx } from '../audio/sfx'
import { on } from '../events'
import { check } from '../puzzle/chain'
import { useRoom } from '../room/RoomScene'
import type { GhostDef } from '../room/roomDef'
import { createGhostRuntime, runtime } from '../runtime'
import { useGame } from '../store'
import { tuning } from '../tuning'
import { createDrop, disposeDrop, stepDrop } from './dropItem'
import type { Drop } from './dropItem'
import { createMimicBrain, isRevealed, startMimicDissolve, stepMimic } from './mimicBrain'
import type { MimicBrain } from './mimicBrain'
import { createMimicMaterial } from './mimicMaterial'
import type { MimicMaterial } from './mimicMaterial'

const LIGHT_COLOR = 0x8fffd6
const LIGHT_TEST_LIFT = 0.03 // m above the object's top face, inside the 5 cm blocked() ignores
const REVEAL_LIFT = 0.17 // m from a spot's base to the middle of the true shape
const X = new Vector3(1, 0, 0)
const _tilt = new Quaternion()

interface Spot {
  base: Vector3 // the spawn: where the true shape stands
  centre: Vector3 // just above the decoy's top face, to test the light on
  decoy: Object3D
  disguise: Object3D
  at: Vector3 // the decoy's position and turn, which the disguise copies
  turn: Quaternion
}

interface Live {
  brain: MimicBrain
  spots: Spot[]
  disguises: Object3D[]
  group: Group // carries the true shape
  light: PointLight
  look: MimicMaterial
  drop: Drop | null
}

// The key ghost of the Library. Sits as one of a few ordinary objects (the
// table's books, a stool), twitches, and shows its true shape when white light
// rests on it. It is the only writer of its runtime.ghosts entry.
export function Mimic({ ghost: def }: { ghost: GhostDef }) {
  const room = useRoom()
  const scene = useThree((s) => s.scene)
  const live = useRef<Live | null>(null)

  useEffect(() => {
    const mesh = room.ghosts.get(def.mesh)
    const defs = def.spots ?? []
    const spots: Spot[] = []
    for (const s of defs) {
      const spawn = room.spawns.get(s.spawn)
      const decoy = room.nodes.get(s.decoy)
      const disguise = room.nodes.get(s.disguise)
      if (!spawn || !decoy || !disguise) return
      decoy.updateWorldMatrix(true, false)
      // The light is tested just above the object's top face. Its own meshes are
      // occluders (a ray ignores .visible), and a point inside a 5 cm book lies
      // behind the top face for any ray that comes in at a slant.
      const box = new Box3().setFromObject(decoy)
      const centre = box.getCenter(new Vector3())
      centre.y = box.max.y + LIGHT_TEST_LIFT
      spots.push({
        base: spawn.clone(),
        centre,
        decoy,
        disguise,
        at: decoy.getWorldPosition(new Vector3()),
        turn: decoy.getWorldQuaternion(new Quaternion()),
      })
    }
    if (!mesh || spots.length === 0) return

    // ?mimic=N starts it on spot N (1-based), for testing.
    const asked = Number(new URLSearchParams(window.location.search).get('mimic'))
    const brain = createMimicBrain(spots.length, asked > 0 ? asked - 1 : undefined)

    const look = createMimicMaterial()
    const original = mesh.material
    mesh.material = look.material
    mesh.position.set(0, 0, 0) // the group carries the position
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.frustumCulled = false
    mesh.renderOrder = 10

    const light = new PointLight(LIGHT_COLOR, 0, 2.5, 2)
    light.castShadow = false
    light.position.set(0, REVEAL_LIFT, 0)
    const group = new Group()
    group.name = `${def.mesh}_Root`
    group.add(mesh, light)
    group.visible = false
    scene.add(group)

    const disguises = [...new Set(spots.map((s) => s.disguise))]
    const w: Live = { brain, spots, disguises, group, light, look, drop: null }
    live.current = w

    const shared = createGhostRuntime(def.id)
    shared.object = mesh
    shared.position.copy(spots[brain.spot].base).y += REVEAL_LIFT
    shared.state = 'disguised'
    shared.photographable = false
    runtime.ghosts.set(def.id, shared)

    const off = on('photo', ({ ghostId, quality }) => {
      if (ghostId !== def.id || quality === null) return
      if (!isRevealed(brain) || quality < tuning.photoDissolveQuality) return
      startMimicDissolve(brain)
      sfx.play('wispDissolve')
    })

    return () => {
      off()
      live.current = null
      if (w.drop) disposeDrop(w.drop)
      for (const s of spots) s.decoy.visible = true
      for (const d of disguises) d.visible = false
      group.removeFromParent()
      mesh.removeFromParent()
      mesh.material = original
      look.material.dispose()
      if (runtime.ghosts.get(def.id) === shared) runtime.ghosts.delete(def.id)
    }
  }, [room, scene, def])

  useFrame((_, delta) => {
    const w = live.current
    if (!w) return
    const { brain, spots, disguises, group, light, look } = w
    const game = useGame.getState()
    if (game.paused || game.uiLock) return
    const dt = Math.min(delta, tuning.maxFrameDt)

    // The lamp was handed over some other way (a debug skip): it is caught.
    if (def.drops && !w.drop && check(def.drops.sets)) startMimicDissolve(brain)

    stepMimic(brain, dt, {
      beam: runtime.beam,
      occluders: room.occluders,
      centres: spots.map((s) => s.centre),
    })

    // The disguise stands where its decoy does and takes its place; the decoy
    // under it is hidden. Once the Mimic is caught every decoy is back.
    const caught = brain.state === 'dissolve' || brain.state === 'gone'
    spots.forEach((s, i) => (s.decoy.visible = caught || i !== brain.spot))
    const showDisguise = brain.state === 'disguised' && brain.hideWait <= 0
    for (const d of disguises) d.visible = false
    if (showDisguise) {
      const spot = spots[brain.spot]
      const d = spot.disguise
      d.visible = true
      // Twitch: a short shake and rock, dying away.
      const k =
        brain.twitchLeft > 0
          ? (brain.twitchLeft / tuning.mimicTwitchSeconds) * Math.sin(brain.clock * 63)
          : 0
      const shake = k * tuning.mimicTwitchShake
      _pos.copy(spot.at)
      d.parent?.worldToLocal(_pos)
      d.position.copy(_pos)
      d.position.x += shake
      d.position.z += Math.cos(brain.clock * 47) * shake
      d.quaternion.copy(spot.turn).multiply(_tilt.setFromAxisAngle(X, k * tuning.mimicTwitchTilt))
    }

    if (brain.onTwitch) {
      brain.onTwitch = false
      if (runtime.player.position.distanceTo(spots[brain.spot].centre) < 7) sfx.play('mimicScrape')
    }
    if (brain.onReveal) {
      brain.onReveal = false
      sfx.play('mimicReveal')
    }
    if (brain.onHide) brain.onHide = false

    // The true shape stands on the spot where it was caught in the light.
    const reveal = spots[brain.revealSpot]
    const showTrue = brain.pop > 0 || brain.state === 'dissolve'
    group.visible = showTrue && brain.state !== 'gone'
    if (group.visible) {
      group.position.copy(reveal.base)
      const s = 0.55 + 0.45 * Math.min(1, brain.pop)
      group.scale.set(s, s, s)
      // It faces the player, as the Wisp does.
      const p = runtime.player.position
      group.rotation.y = Math.atan2(p.x - reveal.base.x, p.z - reveal.base.z)
    }

    // The item falls out as it comes apart, from just above where it stood.
    if (def.drops && !w.drop && !game.pickedUp[def.drops.pickup] && caught) {
      w.drop = createDrop(room, def.drops, reveal.base.clone().setY(reveal.base.y + 0.4))
    }
    if (w.drop) stepDrop(w.drop, dt)

    const u = look.uniforms
    u.time.value += dt
    u.exposure.value = brain.exposure
    u.dissolve.value = brain.dissolve
    u.glow.value = tuning.wispGlow
    u.exposureGlow.value = tuning.wispExposureGlow
    light.intensity = tuning.wispLight * brain.pop * (1 - brain.dissolve)

    const shared = runtime.ghosts.get(def.id)
    if (!shared) return
    shared.position.copy(reveal.base).y += REVEAL_LIFT
    shared.speed = 0
    shared.exposure = brain.exposure
    shared.state = brain.state
    shared.photographable = isRevealed(brain)
    if (brain.state === 'gone' && shared.object) {
      shared.object.removeFromParent()
      shared.object = null
      light.intensity = 0
    }
  })

  return null
}

const _pos = new Vector3()
