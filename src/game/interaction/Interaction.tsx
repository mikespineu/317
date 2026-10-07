import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { on } from '../events'
import { useRoom } from '../room/RoomScene'
import { useGame } from '../store'
import { tuning } from '../tuning'
import { Highlight } from './Highlight'
import { bindRoom, interactWith, syncPickups } from './actions'
import { advanceTweens, clearTweens } from './tweens'
import { pick, useInteractionRay } from './useInteractionRay'

// Interaction ray, highlight, actions and their tweens.
export function Interaction() {
  const room = useRoom()
  const camera = useThree((s) => s.camera)
  useInteractionRay()

  useEffect(() => {
    bindRoom(room)
    syncPickups()
    // The store only changes on events, so syncing on every change is cheap;
    // it only writes .visible.
    const unsubscribe = useGame.subscribe(syncPickups)
    return () => {
      unsubscribe()
      clearTweens()
      bindRoom(null)
    }
  }, [room])

  useEffect(
    () =>
      on('interact', ({ ndc }) => {
        const s = useGame.getState()
        if (s.paused || s.uiLock || s.cameraRaised) return
        // A tap acts on what is under the finger, E on what is under the crosshair.
        const target = ndc ? pick(room, camera, ndc) : s.focus
        if (target) interactWith(target)
      }),
    [room, camera],
  )

  useFrame((_, dt) => {
    const s = useGame.getState()
    if (s.paused || s.uiLock) return
    advanceTweens(Math.min(dt, tuning.maxFrameDt))
  })

  return <Highlight />
}
