import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { useRoomDef } from '../room/RoomContext'
import { useRoom } from '../room/RoomScene'
import { runtime } from '../runtime'
import { useGame } from '../store'
import { tuning } from '../tuning'
import { moveCircle } from './collision'

// Scene component: turns runtime.input into camera motion. Yaw 0 looks north
// (-Z). Look deltas are in screen terms: positive lookDX turns right, positive
// lookDY looks down.
export function PlayerController() {
  const room = useRoom()
  const def = useRoomDef()
  const camera = useThree((s) => s.camera)
  const feet = useRef({ x: 0, z: 0 })

  useLayoutEffect(() => {
    const spawn = room.spawns.get(def.spawn)
    feet.current.x = spawn?.x ?? 0
    feet.current.z = spawn?.z ?? 0
    const { input, player } = runtime
    input.lookDX = input.lookDY = 0
    player.yaw = ((def.spawnYawDeg ?? 0) * Math.PI) / 180
    player.pitch = 0
    player.position.set(feet.current.x, tuning.eyeHeight, feet.current.z)
    camera.position.copy(player.position)
    camera.rotation.set(0, player.yaw, 0, 'YXZ')
  }, [room, def, camera])

  useFrame((_, delta) => {
    const { input, player } = runtime
    const { paused, uiLock } = useGame.getState()
    const pos = feet.current

    // Always drain the look deltas, so motion gathered while paused is dropped.
    const lookDX = input.lookDX
    const lookDY = input.lookDY
    input.lookDX = input.lookDY = 0

    // The intro's lock holds the feet, not the head: look deltas an input
    // module still gathers there are applied. Intro itself nudges yaw and
    // pitch (the ease toward the clock, the slam's shake) through
    // runtime.player. Every other lock freezes the view as before.
    if (!paused && (uiLock === null || uiLock === 'intro')) {
      const limit = (tuning.pitchLimitDeg * Math.PI) / 180
      player.yaw -= lookDX
      player.pitch = Math.min(limit, Math.max(-limit, player.pitch - lookDY))
    }

    if (!paused && uiLock === null) {
      const dt = Math.min(delta, tuning.maxFrameDt)
      let mx = input.moveX
      let my = input.moveY
      const len = Math.hypot(mx, my)
      if (len > 1) {
        mx /= len
        my /= len
      }
      if (len > 0) {
        const step = tuning.walkSpeed * dt
        const sin = Math.sin(player.yaw)
        const cos = Math.cos(player.yaw)
        // forward = (-sin, -cos), right = (cos, -sin) on XZ
        const dx = (mx * cos - my * sin) * step
        const dz = (-mx * sin - my * cos) * step
        moveCircle(pos, dx, dz, tuning.playerRadius, runtime.colliders)
      }
    }

    player.position.set(pos.x, tuning.eyeHeight, pos.z)
    camera.position.copy(player.position)
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ')
  })

  return null
}
