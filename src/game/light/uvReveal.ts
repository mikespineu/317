import { Color, MathUtils, Vector3 } from 'three/webgpu'
import type { Node } from 'three/webgpu'
import { dot, length, normalize, positionWorld, smoothstep, uniform } from 'three/tsl'
import { runtime } from '../runtime'
import { tuning } from '../tuning'

// Shared beam uniforms, written once per frame by the flashlight
// (syncBeamUniforms). Any material can read them: the UV set drives hidden
// ink, the beam set drives dust and the volumetric cone in either mode.

export const uvPos = uniform(new Vector3())
export const uvDir = uniform(new Vector3(0, 0, -1))
export const uvCos = uniform(Math.cos(MathUtils.degToRad(tuning.uvAngleDeg))) // cosine of the half-angle
export const uvRange = uniform(tuning.uvDist)
export const uvPower = uniform(0) // 0 unless the UV lamp is lit; scales with battery strength

export const beamPos = uniform(new Vector3())
export const beamDir = uniform(new Vector3(0, 0, -1))
export const beamCos = uniform(runtime.beam.cos)
export const beamRange = uniform(runtime.beam.range)
export const beamStrength = uniform(0) // 0 when the light is off
export const beamColor = uniform(new Color(0xffffff))

// 0..1 for a world position inside a cone: soft at the edge, fading to zero
// at `range`.
export function coneMask(
  position: Node<'vec3'>,
  origin: Node<'vec3'>,
  dir: Node<'vec3'>,
  cos: Node<'float'>,
  range: Node<'float'>,
  edge = 0.04,
) {
  const toFrag = position.sub(origin)
  const inCone = smoothstep(cos, cos.add(edge), dot(normalize(toFrag), dir))
  const falloff = length(toFrag).div(range).oneMinus().clamp()
  return inCone.mul(falloff)
}

// How strongly the UV lamp hits this fragment. Multiply a hidden layer by it.
export function uvMask(position: Node<'vec3'> = positionWorld) {
  return coneMask(position, uvPos, uvDir, uvCos, uvRange).mul(uvPower)
}

// The same test on the CPU, for gameplay checks (clue logging).
export function uvMaskAt(point: Vector3) {
  const { origin, dir, cos, range, strength, mode } = runtime.beam
  if (mode !== 'uv' || strength <= 0) return 0
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  const dz = point.z - origin.z
  const dist = Math.hypot(dx, dy, dz)
  if (dist < 1e-4 || dist >= range) return 0
  const along = (dx * dir.x + dy * dir.y + dz * dir.z) / dist
  return MathUtils.smoothstep(along, cos, cos + 0.04) * (1 - dist / range) * strength
}

const WHITE = new Color(0xffd9a0)
const UV = new Color(0x8a4dff)

// Copies runtime.beam into the uniforms. Called by the flashlight after it
// has written runtime.beam for the frame.
export function syncBeamUniforms() {
  const { origin, dir, cos, range, strength, mode } = runtime.beam
  beamPos.value.copy(origin)
  beamDir.value.copy(dir)
  beamCos.value = cos
  beamRange.value = range
  beamStrength.value = strength
  beamColor.value.copy(mode === 'uv' ? UV : WHITE)

  uvPos.value.copy(origin)
  uvDir.value.copy(dir)
  uvCos.value = cos
  uvRange.value = range
  uvPower.value = mode === 'uv' ? strength : 0
}

export const beamColors = { white: WHITE, uv: UV }
