import { Frustum, Matrix4, Vector3 } from 'three/webgpu'
import type { Mesh, PerspectiveCamera } from 'three/webgpu'
import { beamOn, blocked } from '../ghost/wispBrain'
import { runtime } from '../runtime'
import type { PhotoParts } from '../store'
import { tuning } from '../tuning'

export interface PhotoScore {
  score: number
  quality: number // 0..1
  parts: PhotoParts
}

const _frustum = new Frustum()
const _matrix = new Matrix4()
const _eye = new Vector3()
const _v = new Vector3()

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

// Scores a shot from scene data at the moment the shutter fires, not from
// pixels. Returns null when no ghost is visible: that is just a photo.
export function scorePhoto(
  camera: PerspectiveCamera,
  baseScore: number,
  occluders: Mesh[],
): PhotoScore | null {
  const wisp = runtime.wisp
  if (!wisp.object || wisp.state === 'gone' || wisp.state === 'dissolve') return null

  camera.updateMatrixWorld()
  _matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  _frustum.setFromProjectionMatrix(_matrix, camera.coordinateSystem, camera.reversedDepth)
  if (!_frustum.containsPoint(wisp.position)) return null
  camera.getWorldPosition(_eye)
  if (blocked(_eye, wisp.position, occluders)) return null

  const lit = clamp01(beamOn(wisp.position, runtime.beam, occluders))

  _v.copy(wisp.position).project(camera)
  const framed = 1 - clamp01(Math.hypot(_v.x, _v.y) / tuning.photoFramedRadius)

  // Share of the screen height the ghost fills at its depth, with the zoom applied.
  const depth = -_v.copy(wisp.position).applyMatrix4(camera.matrixWorldInverse).z
  const viewHeight = 2 * Math.max(0.01, depth) * Math.tan((camera.fov * Math.PI) / 360)
  const close = clamp01(tuning.ghostHeight / viewHeight / tuning.photoCloseFraction)

  const sharp = 1 - clamp01(wisp.speed / tuning.photoSharpSpeed)

  const quality = clamp01(
    tuning.photoWeightLit * lit +
      tuning.photoWeightFramed * framed +
      tuning.photoWeightClose * close +
      tuning.photoWeightSharp * sharp,
  )
  return { score: Math.round(baseScore * quality), quality, parts: { lit, framed, close, sharp } }
}
