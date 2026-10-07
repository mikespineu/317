import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type * as THREE from 'three/webgpu'
import { createPostPipeline } from './postprocessing'

// Owns rendering. A positive-priority frame callback switches off R3F's own
// render, so this must draw every frame, effects or not; with every effect
// off the pipeline is a plain pass-through. Photo capture reads the canvas at
// priority 2, right after this.
export function PostFx() {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer
  const scene = useThree((s) => s.scene) as unknown as THREE.Scene
  const camera = useThree((s) => s.camera) as unknown as THREE.Camera
  const failed = useRef(false)

  const pipeline = useMemo(() => {
    failed.current = false
    return createPostPipeline(gl, scene, camera)
  }, [gl, scene, camera])

  useEffect(() => () => pipeline.dispose(), [pipeline])

  useFrame(() => {
    if (!failed.current) {
      try {
        pipeline.render()
        return
      } catch (err) {
        // Keep the game visible if the node pipeline cannot build here.
        failed.current = true
        console.error('PostFx: pipeline failed, rendering without effects', err)
      }
    }
    gl.render(scene, camera)
  }, 1)

  return null
}
