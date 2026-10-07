import { Canvas, extend } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { Room } from './Room'
import { CameraOverlay } from './camera/CameraOverlay'
import { DebugPanel } from './debug/DebugPanel'
import { DEBUG } from './debug'
import { IntroOverlay } from './intro/IntroOverlay'
import { TouchControls } from './player/touchInput'
import { NoteUI } from './puzzle/NoteUI'
import { PadlockUI } from './puzzle/PadlockUI'
import { SymbolLockUI } from './puzzle/SymbolLockUI'
import { createRenderer } from './renderer/createRenderer'
import { currentRoom } from './room/rooms'
import { quality } from './renderer/quality'
import { Hud } from './ui/Hud'
import { useGame } from './store'
import { PhotoCard } from './ui/PhotoCard'
import { RotatePrompt } from './ui/RotatePrompt'

// Register the three/webgpu classes (node materials included) with R3F.
extend(THREE as any)

export default function Game() {
  // resetLevel bumps epoch; the new key remounts the whole scene.
  const epoch = useGame((s) => s.epoch)
  // The `game` class is a hook for the input code, not a style.
  return (
    <div className="game fixed inset-0 touch-none">
      <Canvas
        shadows
        dpr={[1, quality.dpr]}
        camera={{ position: [0, 1.6, 1.8], fov: 70, near: 0.05, far: 30 }}
        gl={createRenderer}
      >
        <Room key={epoch} def={currentRoom()} />
      </Canvas>
      <IntroOverlay />
      <CameraOverlay />
      <Hud />
      <TouchControls />
      <PadlockUI />
      <SymbolLockUI />
      <NoteUI />
      <PhotoCard />
      <RotatePrompt />
      {DEBUG && <DebugPanel />}
    </div>
  )
}
