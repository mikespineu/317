import { Box3, Vector3 } from 'three/webgpu'
import type { Material, Mesh, Object3D } from 'three/webgpu'
import { lookup, t, tr } from '#/i18n'
import { sfx } from '../audio/sfx'
import { apply, check, consume } from '../puzzle/chain'
import { grabProp } from '../props/propPhysics'
import type { BoundRoom } from '../room/bindNodes'
import { currentRoom } from '../room/rooms'
import type { InteractableDef } from '../room/roomDef'
import { runtime } from '../runtime'
import { useGame } from '../store'
import { tuning } from '../tuning'
import { showMessage, useHud } from './hudState'
import { easeIn, easeOut, tween } from './tweens'

// Actions are chosen by `type`, never by node name. The room is fixed for
// the life of the page, so its lists are read once.
const { interactables, pickups, props, notes, exit } = currentRoom()

export const INTERACT = 'Interact_'
export const CANDLE_FLAG = 'candle-lit'
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

// Disabled entries are bound but do nothing; hidden pickups are never offered.
const findInteractable = (node: string) =>
  interactables.find((i) => i.node === node && i.enabled !== false)
const findPickup = (node: string) => pickups.find((p) => p.node === node && !p.hidden)
const findProp = (node: string) => props.find((p) => p.node === node && p.throwable)

// A door has no `sets` in the definition, so its open state gets its own flag.
const openedFlag = (node: string) => `flag:opened:${node}`

// A search has no open state of its own either when the definition sets nothing.
const doneFlag = (def: InteractableDef) => def.sets ?? openedFlag(def.node)

// What a prompt calls the thing. Without a name in the definition:
// 'Interact_Coat_Pocket' -> 'coat pocket'.
const nameOf = (def: InteractableDef) =>
  def.name ? tr(def.name) : def.node.replace(INTERACT, '').replace(/_/g, ' ').toLowerCase()

// 'acc' is the form after a verb ("Pick up ..."), for languages that have one.
export function itemLabel(item: string, form?: 'acc') {
  return (
    (form && lookup(`item.${item}.${form}`)) ?? lookup(`item.${item}`) ?? item.replace(/-/g, ' ')
  )
}

// The interactable a lock's mesh belongs to. The interaction ray uses it, so
// aiming at a lock that is not a child of its lid still finds the lid.
export function lockOwners(): readonly { mesh: string; node: string }[] {
  return interactables
    .filter((i) => i.lock && i.enabled !== false)
    .map((i) => ({ mesh: i.lock!.mesh, node: i.node }))
}

// What the HUD shows for a node, or null when there is nothing left to do with it.
export function promptFor(node: string | null): Prompt | null {
  if (!node) return null
  const pickup = findPickup(node)
  if (pickup) {
    if (useGame.getState().pickedUp[node] || !check(pickup.visibleWhen)) return null
    return { label: t('prompt.pickUp', { item: itemLabel(pickup.item, 'acc') }), usable: true }
  }
  const prop = findProp(node)
  if (prop) return { label: t('prompt.grab', { prop: tr(prop.label) }), usable: true }
  const def = findInteractable(node)
  if (!def) return null
  // Something in the way (the books in front of the panel): nothing to do yet.
  if (def.availableWhen && !check(def.availableWhen)) return null
  switch (def.type) {
    case 'read':
      return { label: t('prompt.read', { name: nameOf(def) }), usable: true }
    case 'drawer':
      if (def.lock && !check(def.lock.sets)) return { label: t('prompt.drawer.unlock'), usable: true }
      return check(def.sets) ? null : { label: t('prompt.drawer.open'), usable: true }
    case 'lid':
      if (check(def.sets)) return null
      if (def.lock && !check(def.lock.sets))
        return { label: t('prompt.lid.unlock', { name: nameOf(def) }), usable: true }
      return { label: t('prompt.lid.open', { name: nameOf(def) }), usable: true }
    case 'search':
      return check(doneFlag(def))
        ? null
        : { label: t('prompt.search', { name: nameOf(def) }), usable: true }
    case 'locked':
      return { label: t('prompt.try'), usable: true }
    case 'inspect':
      return { label: t('prompt.look'), usable: true }
    case 'door':
      if (check(openedFlag(node))) return null
      return { label: t(check(def.requires) ? 'prompt.door.open' : 'prompt.door.locked'), usable: true }
    case 'candle': {
      const what = (def.flames?.length ?? 1) > 1 ? 'candles' : 'candle'
      const lit = useGame.getState().flags[CANDLE_FLAG]
      return { label: t(`prompt.${what}.${lit ? 'out' : 'light'}`), usable: true }
    }
    case 'uv-reveal':
      // A clue surface, not something to use.
      return check(def.gives) ? null : { label: t('prompt.uvFaint'), usable: false }
    default:
      return null
  }
}

// The prompt while a prop is in the player's hands: the next press throws it.
export function heldPrompt(node: string): Prompt {
  const prop = findProp(node)
  return {
    label: prop ? t('prompt.throw', { prop: tr(prop.label) }) : t('prompt.throwIt'),
    usable: true,
  }
}

// A short note for the HUD once a clue is known and a lock is still shut.
// It never prints the code itself.
export function clueNote(): string | null {
  if (useGame.getState().clues.length === 0) return null
  const shut = interactables.find((i) => i.codeNote && i.lock?.type === 'code' && !check(i.lock.sets))
  return shut?.codeNote ? tr(shut.codeNote) : null
}

// Pickups show iff they were not taken and their condition holds. Runs on
// every store change, so a respawned pack (pickedUp back to false) reappears.
export function syncPickups() {
  if (!room) return
  const { pickedUp } = useGame.getState()
  for (const p of pickups) {
    const node = room.pickups.get(p.node)
    if (node) node.visible = !p.hidden && !pickedUp[p.node] && check(p.visibleWhen)
  }
}

// Puts a taken pickup back in the room, at a Spawn_ when one is named (the
// emergency battery pack).
export function respawnPickup(node: string, spawn?: string) {
  const object = room?.pickups.get(node)
  const at = spawn ? room?.spawns.get(spawn) : undefined
  if (object && at) {
    object.parent?.worldToLocal(object.position.copy(at))
    object.position.y += 0.03
  }
  useGame.getState().setPickedUp(node, false)
}

export function interactWith(node: string) {
  const s = useGame.getState()
  const pickup = findPickup(node)
  if (pickup) {
    if (s.pickedUp[node] || !check(pickup.visibleWhen)) return
    s.setPickedUp(node, true)
    s.addItem(pickup.item)
    if (pickup.note) {
      // The note is the message: it opens over the game.
      sfx.play('letterUnfold')
      openNote(pickup.note)
      return
    }
    sfx.play('pickup')
    showMessage(t('msg.pickedUp', { item: itemLabel(pickup.item) }))
    return
  }
  if (findProp(node)) {
    grabProp(node)
    return
  }
  const def = findInteractable(node)
  if (!def) return
  if (def.type === 'drawer') operateDrawer(def)
  else if (def.type === 'door') operateDoor(def)
  else if (def.type === 'lid') operateLid(def)
  else if (def.type === 'search') startSearch(def)
  else if (def.type === 'read') {
    if (def.note) {
      sfx.play('pageRustle')
      openNote(def.note)
    }
  }
  else if (def.type === 'candle') toggleCandle()
  else if (def.type === 'locked') {
    sfx.play('locked')
    if (def.line) showMessage(tr(def.line))
  } else if (def.type === 'inspect') {
    if (def.line) showMessage(tr(def.line))
  }
}

// Shows a note and grants what reading it gives (the store takes the UI lock).
function openNote(id: string) {
  if (!notes?.[id]) return
  useGame.getState().setOpenNote(id)
  apply(notes[id].gives)
}

// The flame and its light follow the flag (light/Candle.tsx).
function toggleCandle() {
  const s = useGame.getState()
  const lit = !!s.flags[CANDLE_FLAG]
  s.setFlag(CANDLE_FLAG, !lit)
  sfx.play(lit ? 'candleOut' : 'candleLight')
}

// An item chosen in the bar acts on whatever is under the crosshair.
export function applyItemToFocus(item: string) {
  const { focus, uiLock, paused } = useGame.getState()
  if (uiLock) return
  // A note is re-read from the bar, whatever is under the crosshair, and also
  // while paused: on desktop the bar can only be clicked with the pointer free.
  const note = pickups.find((p) => p.item === item && p.note)?.note
  if (note) {
    sfx.play('letterUnfold')
    openNote(note)
    return
  }
  if (paused) return
  const def = focus ? findInteractable(focus) : undefined
  if (def && def.requires === `item:${item}` && promptFor(def.node)) interactWith(def.node)
  else showMessage(t('msg.noUse', { item: itemLabel(item) }))
}

function operateDrawer(def: InteractableDef) {
  if (def.lock && !check(def.lock.sets)) {
    useHud.setState({ lockNode: def.node })
    useGame.getState().setUiLock('padlock')
    return
  }
  if (check(def.sets)) return // already open, and it stays open
  if (!check(def.requires)) {
    sfx.play('locked')
    showMessage(def.lockedLine ? tr(def.lockedLine) : t('msg.needsKey'))
    return
  }
  const node = room?.nodes.get(def.node)
  if (!node) return
  if (def.requires) {
    consume(def.requires) // the key stays in the lock
    sfx.play('keyTurn')
  }
  // Flag first: it blocks a second use mid-slide and lets the key show as the drawer opens.
  apply(def.sets)
  sfx.play('drawerSlide')
  const from = node.position.clone()
  // `slideDir` is already in the parent's space; the default is the node's own +Z.
  const along = def.slideDir
    ? new Vector3(...def.slideDir).normalize()
    : new Vector3(0, 0, 1).applyQuaternion(node.quaternion)
  along.multiplyScalar(def.slide ?? 0)
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
    showMessage(def.lockedLine ? tr(def.lockedLine) : t('msg.needsKey'))
    return
  }
  const node = room?.nodes.get(def.node)
  if (!node) return
  consume(def.requires) // the key stays in the lock
  apply(openedFlag(def.node))
  apply(def.sets)
  sfx.play('doorCreak')
  runMoves(def)
  // The room's clock stops as the exit gives, not when the card appears.
  const isExit = def.node === exit.node
  if (isExit) useGame.getState().markCompleted()

  // The collider was detached from the door on load, so it is found by name.
  const collider = def.node.replace(INTERACT, 'Collider_')
  for (let i = runtime.colliders.length - 1; i >= 0; i--)
    if (runtime.colliders[i].name === collider) runtime.colliders.splice(i, 1)

  // The definition's angle is negated: a positive `openAngleDeg` is a negative
  // Y rotation, which swings Level 0's leaf outward, away from the room.
  const from = node.rotation.y
  const swing = -((def.openAngleDeg ?? 90) * Math.PI) / 180
  tween(
    tuning.doorSeconds,
    (k) => {
      node.rotation.y = from + swing * k
    },
    () => {
      if (!isExit) return
      tween(
        tuning.completeDelay,
        () => {},
        () => useGame.getState().setUiLock('complete'),
      )
    },
  )
}

// Scenery that gets out of the way when a door opens (the ladder). Its
// collider box goes with it, so the way is clear as it looks.
function runMoves(def: InteractableDef) {
  for (const move of def.moves ?? []) {
    const node = room?.nodes.get(move.node)
    if (!node) continue
    const from = node.position.clone()
    const by = new Vector3(...move.by)
    const box = move.collider ? runtime.colliders.find((c) => c.name === move.collider) : undefined
    const base = box ? { ...box } : null
    sfx.play('ladderRoll')
    tween(
      tuning.ladderSeconds,
      (k) => {
        node.position.copy(from).addScaledVector(by, k)
        if (!box || !base) return
        box.minX = base.minX + by.x * k
        box.maxX = base.maxX + by.x * k
        box.minY = base.minY + by.y * k
        box.maxY = base.maxY + by.y * k
        box.minZ = base.minZ + by.z * k
        box.maxZ = base.maxZ + by.z * k
      },
      undefined,
      easeOut,
    )
  }
}

// A lid is a door on another hinge. Its angle is used as given: about X, a
// negative angle lifts the front edge of a lid hinged at the back (-Z).
function operateLid(def: InteractableDef) {
  if (check(def.sets)) return
  if (def.lock && !check(def.lock.sets)) {
    useHud.setState({ lockNode: def.node })
    useGame.getState().setUiLock(def.lock.type === 'symbol' ? 'symbol-lock' : 'padlock')
    return
  }
  const node = room?.nodes.get(def.node)
  if (!node) return
  // Flag first, as for the drawer: what lies inside shows as the lid lifts.
  apply(def.sets)
  sfx.play('lidCreak')
  const axis = def.hingeAxis ?? 'x'
  const from = node.rotation[axis]
  const swing = ((def.openAngleDeg ?? -90) * Math.PI) / 180
  tween(
    tuning.lidSeconds,
    (k) => {
      node.rotation[axis] = from + swing * k
    },
    undefined,
    easeOut,
  )
}

// A search takes a moment. It is advanced by <Interaction> with the tweens,
// and walking out of reach of the thing calls it off.
let search: { def: InteractableDef; t: number; bounds: Box3 } | null = null

function startSearch(def: InteractableDef) {
  if (search || check(doneFlag(def))) return
  const node = room?.nodes.get(def.node)
  if (!node) return
  search = { def, t: 0, bounds: new Box3().setFromObject(node) }
  sfx.play('rummage')
}

export function advanceSearch(dt: number) {
  if (!search) return
  if (search.bounds.distanceToPoint(runtime.player.position) > tuning.reach) {
    search = null
    return
  }
  search.t += dt
  if (search.t < tuning.searchSeconds) return
  const { def } = search
  search = null
  apply(def.gives)
  apply(doneFlag(def))
  sfx.play('pickup')
  if (def.line) showMessage(tr(def.line))
}

export function clearSearch() {
  search = null
}

// The digits of a node's lock, e.g. '3-1-7' -> [3, 1, 7].
export function lockCode(node: string): number[] {
  const lock = findInteractable(node)?.lock
  return lock?.type === 'code' ? lock.code.split('-').map(Number) : []
}

// Called by the padlock UI on confirm. On the right code the lock opens and
// the UI closes; returns false on a wrong one.
export function tryCode(node: string, digits: readonly number[]): boolean {
  const def = findInteractable(node)
  const lock = def?.lock
  if (lock?.type !== 'code') return false
  const code = lockCode(node)
  if (code.length !== digits.length || code.some((d, i) => d !== digits[i])) return false

  apply(lock.sets)
  sfx.play('padlockOpen')
  useGame.getState().setUiLock(null)
  showMessage(t('msg.padlockOpen'))

  const mesh = room?.nodes.get(lock.mesh)
  // A lid opens by itself once its lock lets go, as the chest does; a drawer is
  // left for the player to open. The lock falls through whatever is under it.
  if (def?.type === 'lid') {
    const open = () => operateLid(def)
    if (mesh) dropAndFade(mesh, open)
    else open()
    return true
  }
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

// The symbols of a node's lock, one id per wheel.
export function lockSymbols(node: string): readonly string[] {
  const lock = findInteractable(node)?.lock
  return lock?.type === 'symbol' ? lock.code : []
}

// Called by the symbol lock UI whenever the wheels change. On the right
// symbols the lock drops off and the lid behind it opens by itself; returns
// false otherwise, with no feedback.
export function trySymbols(node: string, symbols: readonly string[]): boolean {
  const def = findInteractable(node)
  const lock = def?.lock
  if (!def || lock?.type !== 'symbol') return false
  if (lock.code.length !== symbols.length || lock.code.some((s, i) => s !== symbols[i])) return false
  if (check(lock.sets)) return true

  apply(lock.sets)
  sfx.play('chestClunk')
  if (useGame.getState().uiLock === 'symbol-lock') useGame.getState().setUiLock(null)

  const open = () => {
    if (def.type === 'lid') operateLid(def)
  }
  const mesh = room?.nodes.get(lock.mesh)
  if (mesh) dropAndFade(mesh, open)
  else open()
  return true
}

// The lock falls to the floor, fading as it goes. Materials are shared in the
// .glb, so the fade works on clones.
function dropAndFade(object: Object3D, done: () => void) {
  const faded: Material[] = []
  object.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh || Array.isArray(mesh.material)) return
    mesh.material = mesh.material.clone()
    mesh.material.transparent = true
    faded.push(mesh.material)
  })
  const from = object.position.clone()
  const to = object.getWorldPosition(new Vector3()).setY(0)
  object.parent?.worldToLocal(to)
  tween(
    tuning.symbolLockDropSeconds,
    (k) => {
      object.position.lerpVectors(from, to, k)
      for (const material of faded) material.opacity = 1 - k
    },
    () => {
      object.visible = false
      for (const material of faded) material.dispose()
      done()
    },
    easeIn,
  )
}
