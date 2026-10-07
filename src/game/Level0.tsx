import { CameraMode } from './camera/CameraMode'
import { DebugScene } from './debug/DebugScene'
import { DEBUG } from './debug'
import { Wisp } from './ghost/Wisp'
import { Interaction } from './interaction/Interaction'
import { Candle } from './light/Candle'
import { Flashlight } from './light/Flashlight'
import { PaintingReveal } from './light/PaintingReveal'
import { Mirror } from './mirror/Mirror'
import { Props } from './props/Props'
import { PlayerController } from './player/PlayerController'
import { Atmosphere } from './renderer/Atmosphere'
import { PostFx } from './renderer/PostFx'
import { RoomScene } from './room/RoomScene'
import { level0 } from './room/level0.def'

// Scene composition for the Level 0 study. Each system is one component; they
// talk through the store, runtime.ts and events.ts, never to each other.
export function Level0() {
  return (
    <>
      <Atmosphere />
      <RoomScene def={level0}>
        <PlayerController />
        <Flashlight />
        <Candle />
        <PaintingReveal />
        <Interaction />
        <Props />
        <Mirror />
        <Wisp />
        <CameraMode />
        {DEBUG && <DebugScene />}
      </RoomScene>
      <PostFx />
    </>
  )
}
