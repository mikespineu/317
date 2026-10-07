import { Vector3 } from 'three/webgpu'
import { sfx } from '../audio/sfx'
import { apply, check, consume } from '../puzzle/chain'
import type { BoundRoom } from '../room/bindNodes'
import { level0 } from '../room/level0.def'
import { runtime } from '../runtime'
import { useGame } from '../store'
import { tuning } from '../tuning'
import { showMessage, useHud } from './hudState'
import { easeIn, easeOut, tween } from './tweens'

// The loose shape of the definition's entries, as room JSON will have them.
// Actions are chosen by `type`, never by node name.
interface LockDef {
  type: string
  code: string
  mesh: string
  sets: string
}
interface InteractableDef {
  node: string
  type: string
  requires?: string
  sets?: string
  gives?: readonly string[]
  slide?: number
  openAngleDeg?: number
  lock?: LockDef
}
interface PickupDef {
  node: string
  item: string
  visibleWhen?: string
}

const interactables: readonly InteractableDef[] = level0.interactables
const pickups: readonly PickupDef[] = level0.pickups

export const INTERACT = 'Interact_'
export const PICKUP = 'Pickup_'

export interface Prompt {
  label: string
  usable: boolean // false = a hint only: no key cap, no highlight, E does nothing
}

let room: BoundRoom | null = null

// Called by <Interaction> once the room is loaded; the DOM overlays (padlock,
// item bar) reach the scene through here.
export function bindRoom(next: BoundRoom | null) {
  room = next
}

const findInteractable = (node: string) => interactables.find((i) => i.node === node)
const findPickup = (node: string) => pickups.find((p) => p.node === node)

// A door has no `sets` in the definition, so its open state gets its own flag.
const openedFlag = (node: string) => `flag:opened:${node}`

export function itemLabel(item: string) {
  return item === 'battery' ? 'battery pack' : item
}

// What the HUD shows for a node, or null when there is nothing left to do with it.
export function promptFor(node: string | null): Prompt | null {
  if (!node) return null
  const pickup = findPickup(node)
  if (pickup) {
    if (useGame.getState().pickedUp[node] || !check(pickup.visibleWhen)) return null
    return { label: `Pick up ${itemLabel(pickup.item)}`, usable: true }
  }
  const def = findInteractable(node)
  if (!def) return null
  switch (def.type) {
    case 'drawer':
      if (def.lock && !check(def.lock.sets)) return { label: 'Unlock drawer', usable: true }
      return check(def.sets) ? null : { label: 'Open drawer', usable: true }
    case 'door':
      if (check(openedFlag(node))) return null
      return { label: check(def.requires) ? 'Open door' : 'Locked', usable: true }
    case 'uv-reveal':
      // A clue surface, not something to use.
      return check(def.gives) ? null : { label: 'Something faint on the canvas', usable: false }
    default:
      return null
  }
}

// A short note for the HUD once a clue is known and a lock is still shut.
// It never prints the code itself.
export function clueNote(): string | null {
  if (useGame.getState().clues.length === 0) return null
  const locked = interactables.some((i) => i.lock && !check(i.lock.sets))
  return locked ? 'Code found. Try the desk drawer.' : null
}

// Pickups show iff they were not taken and their condition holds. Runs on
// every store change, so a respawned pack (pickedUp back to false) reappears.
export function syncPickups() {
  if (!room) return
  const { pickedUp } = useGame.getState()
  for (const p of pickups) {
    const node = room.pickups.get(p.node)
    if (node) node.visible = !pickedUp[p.node] && check(p.visibleWhen)
  }
}

export function interactWith(node: string) {
  const s = useGame.getState()
  const pickup = findPickup(node)
  if (pickup) {
    if (s.pickedUp[node] || !check(pickup.visibleWhen)) return
    s.setPickedUp(node, true)
    s.addItem(pickup.item)
    sfx.play('pickup')
    showMessage(`Picked up: ${itemLabel(pickup.item)}`)
    return
  }
  const def = findInteractable(node)
  if (!def) return
  if (def.type === 'drawer') operateDrawer(def)
  else if (def.type === 'door') operateDoor(def)
}

// An item chosen in the bar acts on whatever is under the crosshair.
export function applyItemToFocus(item: string) {
  const { focus, uiLock, paused } = useGame.getState()
  if (uiLock || paused) return
  const def = focus ? findInteractable(focus) : undefined
  if (def && def.requires === `item:${item}` && promptFor(def.node)) interactWith(def.node)
  else showMessage(`Nothing here to use the ${itemLabel(item)} on.`)
}

function operateDrawer(def: InteractableDef) {
  if (def.lock && !check(def.lock.sets)) {
    useHud.setState({ lockNode: def.node })
    useGame.getState().setUiLock('padlock')
    return
  }
  if (check(def.sets)) return // already open, and it stays open
  const node = room?.nodes.get(def.node)
  if (!node) return
  // Flag first: it blocks a second use mid-slide and lets the key show as the drawer opens.
  apply(def.sets)
  sfx.play('drawerSlide')
  const from = node.position.clone()
  const along = new Vector3(0, 0, 1).applyQuaternion(node.quaternion).multiplyScalar(def.slide ?? 0)
  tween(
    tuning.drawerSeconds,
    (k) => node.position.copy(from).addScaledVector(along, k),
    undefined,
    easeOut,
  )
}

function operateDoor(def: InteractableDef) {
  if (check(openedFlag(def.node))) return
  if (!check(def.requires)) {
    sfx.play('locked')
    showMessage('Locked. It needs a key.')
    return
  }
  const node = room?.nodes.get(def.node)
  if (!node) return
  consume(def.requires) // the key stays in the lock
  apply(openedFlag(def.node))
  sfx.play('doorCreak')

  // The collider was detached from the door on load, so it is found by name.
  const collider = def.node.replace(INTERACT, 'Collider_')
  for (let i = runtime.colliders.length - 1; i >= 0; i--)
    if (runtime.colliders[i].name === collider) runtime.colliders.splice(i, 1)

  // Negative Y rotation swings the leaf outward, away from the room.
  const from = node.rotation.y
  const swing = -((def.openAngleDeg ?? 90) * Math.PI) / 180
  tween(
    tuning.doorSeconds,
    (k) => {
      node.rotation.y = from + swing * k
    },
    () =>
      tween(
        tuning.completeDelay,
        () => {},
        () => useGame.getState().setUiLock('complete'),
      ),
  )
}

// The digits of a node's lock, e.g. '3-1-7' -> [3, 1, 7].
export function lockCode(node: string): number[] {
  const code = findInteractable(node)?.lock?.code ?? ''
  return code.split('-').map(Number)
}

// Called by the padlock UI on confirm. On the right code the lock opens and
// the UI closes; returns false on a wrong one.
export function tryCode(node: string, digits: readonly number[]): boolean {
  const def = findInteractable(node)
  const lock = def?.lock
  if (!lock) return false
  const code = lockCode(node)
  if (code.length !== digits.length || code.some((d, i) => d !== digits[i])) return false

  apply(lock.sets)
  sfx.play('padlockOpen')
  useGame.getState().setUiLock(null)
  showMessage('The padlock falls open.')

  const mesh = room?.nodes.get(lock.mesh)
  if (mesh) {
    const fromY = mesh.position.y
    const fromX = mesh.rotation.x
    tween(
      tuning.padlockDropSeconds,
      (k) => {
        mesh.position.y = fromY - tuning.padlockDrop * k
        mesh.rotation.x = fromX + k * 1.2
      },
      () => {
        mesh.visible = false
      },
      easeIn,
    )
  }
  return true
}
