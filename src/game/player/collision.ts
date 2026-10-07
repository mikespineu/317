import type { Aabb } from '../runtime'

// Leaves a hair of space after a push so the next pass doesn't read the
// resting contact as an overlap because of rounding.
const SKIN = 1e-3

// Pushes `a` (the circle centre on one axis) out of the box along that axis.
// `b` is the centre on the other axis. Corners are treated as round, so the
// player slips around them instead of catching.
function pushOut(
  a: number,
  b: number,
  r: number,
  minA: number,
  maxA: number,
  minB: number,
  maxB: number,
) {
  const off = b - Math.min(Math.max(b, minB), maxB)
  if (Math.abs(off) >= r) return a
  const half = Math.sqrt(r * r - off * off)
  if (a <= minA - half || a >= maxA + half) return a
  return a < (minA + maxA) / 2 ? minA - half - SKIN : maxA + half + SKIN
}

// Moves a circle on XZ by (dx, dz) against the collider boxes. X and Z are
// resolved one after the other, which is what makes the player slide along a
// wall rather than stop dead. Mutates and returns `pos`.
export function moveCircle(
  pos: { x: number; z: number },
  dx: number,
  dz: number,
  radius: number,
  colliders: readonly Aabb[],
) {
  pos.x += dx
  for (const c of colliders) pos.x = pushOut(pos.x, pos.z, radius, c.minX, c.maxX, c.minZ, c.maxZ)
  pos.z += dz
  for (const c of colliders) pos.z = pushOut(pos.z, pos.x, radius, c.minZ, c.maxZ, c.minX, c.maxX)
  return pos
}
