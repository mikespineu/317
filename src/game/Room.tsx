import { CameraMode } from './camera/CameraMode'
import { DebugScene } from './debug/DebugScene'
import { DEBUG } from './debug'
import { Ghosts } from './ghost/Ghosts'
import { Interaction } from './interaction/Interaction'
import { Intro } from './intro/Intro'
import { Candle } from './light/Candle'
import { Flashlight } from './light/Flashlight'
import { PaintingReveal } from './light/PaintingReveal'
import { UvInk } from './light/UvInk'
import { Mirror } from './mirror/Mirror'
import { Props } from './props/Props'
import { PlayerController } from './player/PlayerController'
import { Atmosphere } from './renderer/Atmosphere'
import { PostFx } from './renderer/PostFx'
import { Portraits } from './room/Portraits'
import { RoomProvider } from './room/RoomContext'
import { RoomScene } from './room/RoomScene'
import type { RoomDef } from './room/roomDef'

// Scene composition for any room definition. Each system is one component;
// they talk through the store, runtime.ts and events.ts, never to each other,
// and read the definition with useRoomDef().
export function Room({ def }: { def: RoomDef }) {
  return (
    <RoomProvider def={def}>
      <Atmosphere />
      <RoomScene def={def}>
        <PlayerController />
        <Flashlight />
        <Candle />
        <PaintingReveal />
        <UvInk />
        <Interaction />
        <Props />
        <Mirror />
        <Portraits />
        <Ghosts />
        <CameraMode />
        {def.intro && <Intro />}
        {DEBUG && <DebugScene />}
      </RoomScene>
      <PostFx />
    </RoomProvider>
  )
}
