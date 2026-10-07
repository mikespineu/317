import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { MathUtils } from 'three/webgpu'
import type { Object3D } from 'three/webgpu'
import { sfx } from '../audio/sfx'
import { useRoomDef } from '../room/RoomContext'
import { useRoom } from '../room/RoomScene'
import { runtime } from '../runtime'
import { useGame } from '../store'
import { tuning } from '../tuning'
import { setIntroView } from './introView'

// The front doors stand open, the clock ticks, then the doors slam, the clock
// stops and the hall goes dark for a moment before the player gets control.
//
// The timeline runs on frame time and only while the game is not paused:
//
// - Desktop starts paused behind the "click to play" card. The intro leaves
//   that alone and takes its lock only once the game is running, so the click
//   that takes the pointer lock starts the intro and can never skip it.
// - Touch has no pause, and audio cannot start before a gesture, so there the
//   intro holds its lock with the doors open and waits for the first tap (the
//   overlay asks for it). That tap is not a skip either.
// - After that, any key, click or tap skips: the doors are shut at once behind
//   the wash of ink, and control comes back when it has cleared.

const SKIP_GUARD = 0.4 // s; a double-click on "click to play" is not a skip

interface Door {
  node: Object3D
  closed: number // rotation.y as loaded
  open: number
}

interface Run {
  phase: 'wait' | 'run' | 'done'
  t: number // seconds of the timeline played
  doors: Door[]
  closed: boolean
  closedAt: number // timeline time of the slam, for the shake and the dip
  skip: boolean // asked for by a gesture; taken on the next frame
  lookYaw: number // the whole turn toward the clock, set when the timeline starts
  lookPitch: number
  looked: number // 0..1 of that turn applied so far
  shakeYaw: number // the shake currently added to runtime.player
  shakePitch: number
}

// The mounted intro, for the gesture listeners and skipIntro().
let active: Run | null = null
// Whether the page has had a gesture yet. Outlives level resets, like the
// audio context it stands for.
let gestured = false

function requestSkip() {
  if (active?.phase === 'run' && active.t >= SKIP_GUARD) active.skip = true
}

if (typeof window !== 'undefined') {
  // Capture phase, so a handler that stops propagation cannot hide a gesture.
  // A mouse press counts at once; a touch only when it lifts, which is the
  // gesture iOS starts audio on.
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch') gestured = true
      requestSkip()
    },
    true,
  )
  window.addEventListener(
    'pointerup',
    () => {
      gestured = true
    },
    true,
  )
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      gestured = true
      requestSkip()
    },
    true,
  )
}

// k: 1 is open, 0 is shut, and shut is exactly the rotation the room loaded with.
function setDoors(run: Run, k: number) {
  for (const d of run.doors)
    d.node.rotation.y = k === 0 ? d.closed : MathUtils.lerp(d.closed, d.open, k)
}

// Shuts the doors exactly and settles the two loops. `slam` is the audible
// way: the bang, and the clock stopping on its next beat.
function shut(run: Run, slam: boolean) {
  if (run.closed) return
  run.closed = true
  run.closedAt = run.t
  setDoors(run, 0)
  sfx.loop('wind', false)
  if (slam) {
    sfx.play('doorSlam')
    sfx.stopTick()
  } else {
    sfx.loop('clockTick', false)
  }
}

function clearShake(run: Run) {
  runtime.player.yaw -= run.shakeYaw
  runtime.player.pitch -= run.shakePitch
  run.shakeYaw = run.shakePitch = 0
}

// The end of the intro, from wherever it is: doors shut, lock released, the
// room's clock started.
function finish(run: Run) {
  if (run.phase === 'done') return
  shut(run, false)
  clearShake(run)
  run.phase = 'done'
  if (active === run) active = null
  setIntroView(0, false)
  const game = useGame.getState()
  if (game.uiLock === 'intro') game.setUiLock(null)
  game.markStarted()
}

// Ends a running intro at once and silently (debug panel, debug skips):
// control is back by the time this returns. Does nothing when no intro runs.
export function skipIntro() {
  if (active) finish(active)
}

export function Intro() {
  const room = useRoom()
  const def = useRoomDef()
  const ref = useRef<Run | null>(null)

  useEffect(() => {
    const intro = def.intro
    if (!intro) return
    const doors: Door[] = []
    for (const name of intro.doors) {
      const node = room.nodes.get(name)
      const deg = node?.userData.intro_open_deg
      if (!node || typeof deg !== 'number') {
        console.warn(`[intro] ${name} is missing, or has no intro_open_deg`)
        continue
      }
      doors.push({ node, closed: node.rotation.y, open: node.rotation.y + MathUtils.degToRad(deg) })
    }
    const run: Run = {
      phase: 'wait',
      t: 0,
      doors,
      closed: false,
      closedAt: 0,
      skip: false,
      lookYaw: 0,
      lookPitch: 0,
      looked: 0,
      shakeYaw: 0,
      shakePitch: 0,
    }
    setDoors(run, 1)
    ref.current = run
    active = run

    // Unmounted mid-intro (Reset level): leave nothing behind. The next mount
    // replays it from the top.
    return () => {
      ref.current = null
      if (active === run) active = null
      if (run.phase === 'done') return
      run.phase = 'done'
      setDoors(run, 0)
      clearShake(run)
      sfx.loop('clockTick', false)
      sfx.loop('wind', false)
      setIntroView(0, false)
      const game = useGame.getState()
      if (game.uiLock === 'intro') game.setUiLock(null)
    }
  }, [room, def])

  useFrame((_, delta) => {
    const run = ref.current
    const intro = def.intro
    if (!run || !intro || run.phase === 'done') return
    const game = useGame.getState()

    // The clock and the night air belong to the open doors, and nothing
    // sounds behind the pause card.
    if (!run.closed) {
      sfx.loop('clockTick', !game.paused)
      sfx.loop('wind', !game.paused)
    }
    if (game.paused) return

    if (run.phase === 'wait') {
      if (game.uiLock === null) game.setUiLock('intro')
      else if (game.uiLock !== 'intro') return // another overlay is up; after it
      if (!gestured) {
        setIntroView(0, true)
        return
      }
      begin(run, room.spawns.get(intro.look))
    }

    run.t += Math.min(delta, tuning.maxFrameDt)
    const slamAt = intro.slamAfter
    const dip = Math.max(tuning.introDipSeconds, 0.001)
    // The lock lasts introLockSeconds, or as long as the slam and the dip need.
    const end = Math.max(tuning.introLockSeconds, slamAt + tuning.introSlamSeconds + 2 * dip)

    if (run.skip) {
      run.skip = false
      if (!run.closed) {
        shut(run, true)
        run.closedAt = -Infinity // already dark, and no shake
      }
      run.t = Math.max(run.t, end - dip)
    }

    // The view eases toward the clock while the doors stand open.
    const { player } = runtime
    const looked = MathUtils.smoothstep(run.t, 0, slamAt)
    player.yaw += run.lookYaw * (looked - run.looked)
    player.pitch += run.lookPitch * (looked - run.looked)
    run.looked = looked

    if (!run.closed && run.t >= slamAt) {
      const p = (run.t - slamAt) / tuning.introSlamSeconds
      if (p < 1) setDoors(run, 1 - p * p) // ease-in: they arrive at full speed
      else shut(run, true)
    }

    // The slam shakes the view. Only the difference from the last frame is
    // added, so the offsets sum to nothing once the shake has run out.
    const since = run.t - run.closedAt
    let yaw = 0
    let pitch = 0
    if (run.closed && since < tuning.introShakeSeconds) {
      const amount = tuning.introShakeAmount * (1 - since / tuning.introShakeSeconds)
      yaw = amount * Math.sin(since * 95)
      pitch = amount * Math.cos(since * 71) * 0.8
    }
    player.yaw += yaw - run.shakeYaw
    player.pitch += pitch - run.shakePitch
    run.shakeYaw = yaw
    run.shakePitch = pitch

    // Dark comes down with the doors and lifts just before control returns.
    const down = run.closed ? since / dip : 0
    setIntroView(Math.min(1, down, (end - run.t) / dip), false)

    if (run.t >= end) finish(run)
  })

  return null
}

// Starts the timeline: works out the small turn toward `target` from where
// the player is looking now, capped at introLookDeg.
function begin(run: Run, target: { x: number; y: number; z: number } | undefined) {
  run.phase = 'run'
  setIntroView(0, false)
  if (!target) return
  const { player } = runtime
  const dx = target.x - player.position.x
  const dy = target.y - player.position.y
  const dz = target.z - player.position.z
  // Yaw 0 looks down -Z and grows to the left; positive pitch looks up.
  const yaw = MathUtils.euclideanModulo(Math.atan2(-dx, -dz) - player.yaw + Math.PI, 2 * Math.PI)
  const dYaw = yaw - Math.PI
  const dPitch = Math.atan2(dy, Math.hypot(dx, dz)) - player.pitch
  const max = MathUtils.degToRad(tuning.introLookDeg)
  const length = Math.hypot(dYaw, dPitch)
  const k = length > max ? max / length : 1
  run.lookYaw = dYaw * k
  run.lookPitch = dPitch * k
}
