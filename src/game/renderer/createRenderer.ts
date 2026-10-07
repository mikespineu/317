import * as THREE from 'three/webgpu'
import { useGame } from '../store'
import { quality } from './quality'

// WebGPU where the browser has it, otherwise the same renderer on WebGL 2.
// ?webgl forces the fallback so both backends can be compared on one device.
export async function createRenderer(props: unknown) {
  const forceWebGL =
    !('gpu' in navigator) || new URLSearchParams(window.location.search).has('webgl')
  const renderer = new THREE.WebGPURenderer({
    ...(props as object),
    antialias: quality.msaa,
    forceWebGL,
  })
  await renderer.init()
  const isWebGPU = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend
  useGame.getState().setBackend(isWebGPU ? 'webgpu' : 'webgl2')
  return renderer
}
