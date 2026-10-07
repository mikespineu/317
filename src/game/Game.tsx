import { useEffect } from 'react'
import { Canvas, extend } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { Level0 } from './Level0'
import { useGame } from './store'

// Register the three/webgpu classes (node materials included) with R3F.
extend(THREE as any)

export default function Game() {
  const lightOn = useGame((s) => s.lightOn)
  const lightMode = useGame((s) => s.lightMode)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyF') useGame.getState().toggleLight()
      if (e.code === 'KeyQ') useGame.getState().switchLightMode()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="game">
      <Canvas
        shadows
        camera={{ position: [0, 1.6, 2.2], rotation: [0, 0, 0], fov: 70 }}
        // WebGPURenderer uses WebGPU where available and falls back to WebGL 2.
        gl={async (props) => {
          const renderer = new THREE.WebGPURenderer(props as any)
          await renderer.init()
          return renderer
        }}
      >
        <Level0 />
      </Canvas>
      <div className="hud">
        Light: {lightOn ? lightMode : 'off'} · F on/off · Q white/UV
      </div>
      <div className="rotate-prompt">Rotate your device to landscape</div>
    </div>
  )
}
