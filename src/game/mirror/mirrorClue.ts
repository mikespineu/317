import { Frustum, Matrix4, Vector3 } from 'three/webgpu'
import type { Camera, Mesh } from 'three/webgpu'
import { sfx } from '../audio/sfx'
import { beamOn, blocked } from '../ghost/wispBrain'
import { apply, check } from '../puzzle/chain'
import type { Token } from '../puzzle/chain'
import { runtime } from '../runtime'
import { tuning } from '../tuning'

// Grants the mirror clue once the player has really read the mirror-only
// writing: it is in the reflection they are looking at, and their light is on
// it. Plain geometry, no extra render pass.

const LIGHT_SAMPLE = 0.05 // m in front of the text; the wall behind it is an occluder
const EDGE = 0.01 // m of slack on the mirror's rectangle
const DECAY = 2 // dwell drains this many times faster than it builds

const _frustum = new Frustum()
const _viewProjection = new Matrix4()
const _eye = new Vector3()
const _dir = new Vector3()
const _hit = new Vector3()
const _local = new Vector3()

export interface MirrorPlane {
  worldCentre: Vector3
  worldNormal: Vector3 // into the room
}

export interface MirrorClue {
  step(dt: number, camera: Camera): void
}

export function createMirrorClue(
  mirror: Mesh,
  plane: MirrorPlane,
  text: Mesh,
  gives: Token,
  occluders: Mesh[],
): MirrorClue {
  const { worldCentre, worldNormal } = plane

  // The text's centre, and a point just off the wall for the light test.
  text.updateWorldMatrix(true, false)
  text.geometry.computeBoundingBox()
  const centre = text.geometry.boundingBox!.getCenter(new Vector3()).applyMatrix4(text.matrixWorld)
  const facing = new Vector3(-1, 0, 0)
  const normals = text.geometry.getAttribute('normal')
  if (normals) facing.fromBufferAttribute(normals, 0).transformDirection(text.matrixWorld)
  if (facing.dot(_dir.subVectors(worldCentre, centre)) < 0) facing.negate()
  const sample = centre.clone().addScaledVector(facing, LIGHT_SAMPLE)

  // Where the text appears to be: mirrored through the glass, behind the wall.
  const depth = _dir.subVectors(centre, worldCentre).dot(worldNormal)
  const image = centre.clone().addScaledVector(worldNormal, -2 * depth)

  mirror.geometry.computeBoundingBox()
  const glass = mirror.geometry.boundingBox!.clone().expandByScalar(EDGE)

  let dwell = 0

  function reading(camera: Camera) {
    // (c) first, the cheapest way out: the light is off or elsewhere.
    if (runtime.beam.strength < tuning.mirrorClueMinLight) return false

    camera.updateMatrixWorld()
    _eye.setFromMatrixPosition(camera.matrixWorld)
    const height = _dir.subVectors(_eye, worldCentre).dot(worldNormal)
    if (height <= 0) return false // behind the glass

    // (a) the mirror and (b) the text's image are on screen
    _viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    _frustum.setFromProjectionMatrix(_viewProjection, camera.coordinateSystem, camera.reversedDepth)
    if (!_frustum.intersectsObject(mirror) || !_frustum.containsPoint(image)) return false

    // ...and the image is seen through the glass, not past its edge.
    _dir.subVectors(image, _eye)
    const along = -_dir.dot(worldNormal)
    if (along <= 1e-4) return false
    _hit.copy(_eye).addScaledVector(_dir, height / along)
    if (!glass.containsPoint(mirror.worldToLocal(_local.copy(_hit)))) return false

    // Nothing stands between the eye and the glass, or the glass and the text.
    if (blocked(_eye, _hit, occluders)) return false
    _hit.addScaledVector(worldNormal, 0.02)
    if (blocked(_hit, sample, occluders)) return false

    return beamOn(sample, runtime.beam, occluders) >= tuning.mirrorClueMinLight
  }

  return {
    step(dt, camera) {
      if (check(gives)) return
      if (reading(camera)) dwell += dt
      else dwell = Math.max(0, dwell - dt * DECAY)
      if (dwell < tuning.mirrorClueDwell) return
      dwell = 0
      apply(gives)
      sfx.play('mirrorChime')
    },
  }
}
