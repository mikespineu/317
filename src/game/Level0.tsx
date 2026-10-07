import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { SpotLight } from 'three'
import { useGame } from './store'

const LIGHT_COLOR = { white: '#ffd9a0', uv: '#8a5cff' } as const

// Grey-box study: placeholder geometry until the Blender assets land.
export function Level0() {
  return (
    <>
      <color attach="background" args={['#07060a']} />
      <ambientLight intensity={0.04} color="#9fb4ff" />
      <Flashlight />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[5, 5]} />
        <meshStandardMaterial color="#5b5148" />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, 1.5, -2.5]} receiveShadow>
        <planeGeometry args={[5, 3]} />
        <meshStandardMaterial color="#6f6a63" />
      </mesh>
      {/* Desk */}
      <mesh position={[-0.8, 0.4, -1.8]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.8, 0.7]} />
        <meshStandardMaterial color="#8a8a8a" />
      </mesh>
      {/* Bookshelf */}
      <mesh position={[1.4, 1, -2.2]} castShadow receiveShadow>
        <boxGeometry args={[1, 2, 0.4]} />
        <meshStandardMaterial color="#7d7d7d" />
      </mesh>
    </>
  )
}

function Flashlight() {
  const light = useRef<SpotLight>(null)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const lightOn = useGame((s) => s.lightOn)
  const lightMode = useGame((s) => s.lightMode)

  // The target has to be in the scene graph for its world matrix to update.
  useEffect(() => {
    const target = light.current?.target
    if (!target) return
    scene.add(target)
    return () => {
      scene.remove(target)
    }
  }, [scene])

  useFrame(() => {
    if (!light.current) return
    light.current.position.copy(camera.position)
    camera.getWorldDirection(light.current.target.position)
    light.current.target.position.add(camera.position)
  })

  return (
    <spotLight
      ref={light}
      visible={lightOn}
      color={LIGHT_COLOR[lightMode]}
      intensity={30}
      angle={0.45}
      penumbra={0.6}
      distance={12}
      castShadow
    />
  )
}
