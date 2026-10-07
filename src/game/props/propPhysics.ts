import { Box3, Euler, Group, Quaternion, Vector3 } from 'three/webgpu'
import type { Camera } from 'three/webgpu'
import { sfx } from '../audio/sfx'
import type { BoundRoom } from '../room/bindNodes'
import { runtime } from '../runtime'
import type { Aabb } from '../runtime'
import { useGame } from '../store'
import { tuning } from '../tuning'

// Throwable props: grab one, carry it in front of the view, throw it. Physics
// is a sphere against the collider boxes, the floor, the ceiling and the room
// walls, with a settle step that lays the prop flat once it stops. Only props
// the room definition marks `throwable` get a body; the body is made the first
// time a prop is grabbed, so untouched props cost nothing.

type State = 'home' | 'held' | 'flying' | 'settling' | 'resting'

interface Body {
  name: string
  pivot: Group // sits at the prop's centre, so spin turns it about its middle
  radius: number
  halfThick: number // half the smallest extent: how high it lies when flat
  restAxis: Vector3 // the smallest axis, in pivot space: points up when it lies flat
  vel: Vector3
  spin: Vector3 // rad/s about a world axis
  state: State
  still: number // seconds spent slow on the ground
  settleQ: Quaternion
  settleY: number
  settleT: number
}

const SUBSTEP = 1 / 120
const SETTLE_AFTER = 0.15 // s
const SETTLE_SECONDS = 0.3
const SETTLE_RATE = 14 // 1/s
const IMPACT_MIN_SPEED = 0.6 // m/s along the normal before a hit costs speed and spin
const HIT_MIN_SPEED = 1.1 // m/s along the normal before a hit makes a sound
const HIT_GAP_MS = 90

const UP = new Vector3(0, 1, 0)
const BACK = new Vector3(0, 0, 1)
const HELD_TILT = new Quaternion().setFromEuler(new Euler(-0.3, 0.4, 0))

const bodies = new Map<string, Body>()
let room: BoundRoom | null = null
let lastHit = 0

const tmp = new Vector3()
const normal = new Vector3()
const q = new Quaternion()
const qTarget = new Quaternion()

export function bindProps(next: BoundRoom | null) {
  room = next
  if (!next) bodies.clear()
}

function bodyFor(name: string): Body | null {
  const existing = bodies.get(name)
  if (existing) return existing
  const node = room?.props.get(name)
  if (!room || !node) return null

  // Props are exported axis-aligned, so the world box is also the local box.
  const box = new Box3().setFromObject(node, true)
  const size = box.getSize(new Vector3())
  const centre = box.getCenter(new Vector3())
  const extents = [size.x, size.y, size.z]
  const sorted = [...extents].sort((a, b) => a - b)
  const restAxis = new Vector3()
  restAxis.setComponent(extents.indexOf(sorted[0]), 1)

  const pivot = new Group()
  pivot.position.copy(centre)
  room.scene.add(pivot)
  pivot.attach(node) // keeps the prop exactly where it stands

  const body: Body = {
    name,
    pivot,
    radius: Math.max(0.03, (sorted[0] + sorted[1]) / 4),
    halfThick: sorted[0] / 2,
    restAxis,
    vel: new Vector3(),
    spin: new Vector3(),
    state: 'home',
    still: 0,
    settleQ: new Quaternion(),
    settleY: 0,
    settleT: 0,
  }
  bodies.set(name, body)
  return body
}

// Pushes a sphere out of a box. Returns true on contact and leaves the push
// direction in `normal`.
function pushFromBox(pos: Vector3, r: number, c: Aabb): boolean {
  const cx = Math.min(Math.max(pos.x, c.minX), c.maxX)
  const cy = Math.min(Math.max(pos.y, c.minY), c.maxY)
  const cz = Math.min(Math.max(pos.z, c.minZ), c.maxZ)
  const dx = pos.x - cx
  const dy = pos.y - cy
  const dz = pos.z - cz
  const d2 = dx * dx + dy * dy + dz * dz
  if (d2 > r * r) return false
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2)
    normal.set(dx / d, dy / d, dz / d)
    pos.addScaledVector(normal, r - d)
    return true
  }
  // The centre is inside the box: leave by the nearest face.
  const faces: [number, number, number, number][] = [
    [pos.x - c.minX, -1, 0, 0],
    [c.maxX - pos.x, 1, 0, 0],
    [pos.y - c.minY, 0, -1, 0],
    [c.maxY - pos.y, 0, 1, 0],
    [pos.z - c.minZ, 0, 0, -1],
    [c.maxZ - pos.z, 0, 0, 1],
  ]
  const [depth, nx, ny, nz] = faces.reduce((a, b) => (b[0] < a[0] ? b : a))
  normal.set(nx, ny, nz)
  pos.addScaledVector(normal, depth + r)
  return true
}

// Resolves a position against everything solid. `onHit` gets each contact
// normal; the throw physics uses it to bounce, the held prop ignores it.
function resolve(pos: Vector3, r: number, onHit?: (n: Vector3) => void) {
  const hit = () => onHit?.(normal)
  if (pos.y < r) {
    pos.y = r
    normal.copy(UP)
    hit()
  }
  if (pos.y > tuning.propCeiling - r) {
    pos.y = tuning.propCeiling - r
    normal.set(0, -1, 0)
    hit()
  }
  const hx = tuning.wispRoomHalfX - r
  const hz = tuning.wispRoomHalfZ - r
  if (pos.x < -hx || pos.x > hx) {
    normal.set(pos.x < 0 ? 1 : -1, 0, 0)
    pos.x = Math.min(Math.max(pos.x, -hx), hx)
    hit()
  }
  if (pos.z < -hz || pos.z > hz) {
    normal.set(0, 0, pos.z < 0 ? 1 : -1)
    pos.z = Math.min(Math.max(pos.z, -hz), hz)
    hit()
  }
  for (const c of runtime.colliders) if (pushFromBox(pos, r, c)) hit()
}

export function grabProp(name: string) {
  const body = bodyFor(name)
  if (!body || useGame.getState().held) return
  body.state = 'held'
  body.vel.set(0, 0, 0)
  body.spin.set(0, 0, 0)
  body.still = 0
  useGame.getState().setHeld(name)
  sfx.play('propGrab')
}

export function throwHeld(camera: Camera) {
  const name = useGame.getState().held
  const body = name ? bodies.get(name) : null
  useGame.getState().setHeld(null)
  if (!body) return
  camera.getWorldDirection(tmp)
  body.vel.copy(tmp).multiplyScalar(tuning.throwSpeed)
  body.vel.y += tuning.throwLift
  // Tumble about the axis across the throw, with a little wobble.
  body.spin
    .crossVectors(tmp, UP)
    .normalize()
    .multiplyScalar(-tuning.throwSpin)
    .add(tmp.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3))
  body.state = 'flying'
  body.still = 0
  sfx.play('propThrow')
}

function stepFlying(body: Body, h: number) {
  const { pivot, vel, spin, radius } = body
  let grounded = false

  vel.y -= tuning.propGravity * h
  pivot.position.addScaledVector(vel, h)
  const w = spin.length()
  if (w > 1e-4) {
    q.setFromAxisAngle(tmp.copy(spin).divideScalar(w), w * h)
    pivot.quaternion.premultiply(q)
  }

  resolve(pivot.position, radius, (n) => {
    const vn = vel.dot(n)
    if (vn >= 0) return
    if (-vn > HIT_MIN_SPEED && performance.now() - lastHit > HIT_GAP_MS) {
      lastHit = performance.now()
      sfx.play('propHit')
    }
    vel.addScaledVector(n, -(1 + tuning.propBounce) * vn)
    // A real impact rubs off some sliding speed and spin; a resting contact
    // is handled by the ground damping below.
    if (-vn > IMPACT_MIN_SPEED) {
      tmp.copy(vel).addScaledVector(n, -vel.dot(n))
      vel.addScaledVector(tmp, -tuning.propFriction)
      spin.multiplyScalar(0.75)
    }
    if (n.y > 0.7) grounded = true
  })

  // Sliding and tumbling on the ground die out over time, not per substep.
  if (grounded) {
    const slide = Math.exp(-tuning.propSlide * h)
    vel.x *= slide
    vel.z *= slide
    spin.multiplyScalar(Math.exp(-8 * h))
  }

  body.still = grounded && vel.length() < tuning.propRestSpeed ? body.still + h : 0
  if (body.still >= SETTLE_AFTER) beginSettle(body)
}

// Stops the prop where it lies and works out the pose that lays it flat.
function beginSettle(body: Body) {
  const { pivot } = body
  body.vel.set(0, 0, 0)
  body.spin.set(0, 0, 0)
  tmp.copy(body.restAxis).applyQuaternion(pivot.quaternion)
  const up = tmp.y >= 0 ? UP : normal.copy(UP).negate()
  body.settleQ.copy(q.setFromUnitVectors(tmp, up)).multiply(pivot.quaternion)
  body.settleY = pivot.position.y - body.radius + body.halfThick
  body.settleT = 0
  body.state = 'settling'
}

function stepSettling(body: Body, dt: number) {
  const { pivot } = body
  const k = Math.min(1, dt * SETTLE_RATE)
  pivot.quaternion.slerp(body.settleQ, k)
  pivot.position.y += (body.settleY - pivot.position.y) * k
  body.settleT += dt
  if (body.settleT >= SETTLE_SECONDS) {
    pivot.quaternion.copy(body.settleQ)
    pivot.position.y = body.settleY
    body.state = 'resting'
  }
}

function stepHeld(body: Body, camera: Camera, dt: number) {
  const { pivot } = body
  const k = 1 - Math.exp(-tuning.holdFollow * dt)

  // Lower right of the view, kept out of the walls so it never pokes through.
  tmp
    .set(tuning.holdRight, -tuning.holdDown, -tuning.holdDistance)
    .applyQuaternion(camera.quaternion)
    .add(camera.position)
  resolve(tmp, body.radius)
  pivot.position.lerp(tmp, k)

  // The big face turns towards the player, tipped a little.
  qTarget.setFromUnitVectors(body.restAxis, BACK)
  qTarget.premultiply(HELD_TILT).premultiply(camera.quaternion)
  pivot.quaternion.slerp(qTarget, k)
}

export function stepProps(camera: Camera, dt: number) {
  for (const body of bodies.values()) {
    switch (body.state) {
      case 'held':
        stepHeld(body, camera, dt)
        break
      case 'flying': {
        let left = dt
        while (left > 1e-6 && body.state === 'flying') {
          const h = Math.min(SUBSTEP, left)
          stepFlying(body, h)
          left -= h
        }
        break
      }
      case 'settling':
        stepSettling(body, dt)
        break
    }
  }
}
