import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRoom } from '../room/RoomScene'
import { useGame } from '../store'
import { tuning } from '../tuning'
import { bindProps, stepProps } from './propPhysics'

// Runs the physics of throwable props: the held one follows the view, thrown
// ones fly and settle. Grabbing and throwing are driven by the interaction
// events, in interaction/.
export function Props() {
  const room = useRoom()
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    bindProps(room)
    return () => bindProps(null)
  }, [room])

  useFrame((_, dt) => {
    const s = useGame.getState()
    if (s.paused || s.uiLock) return
    stepProps(camera, Math.min(dt, tuning.maxFrameDt))
  })

  return null
}
