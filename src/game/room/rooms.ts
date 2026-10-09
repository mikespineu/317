import { level0 } from './level0.def'
import { level1 } from './level1.def'
import { level2 } from './level2.def'
import type { RoomDef } from './roomDef'

// The only module that imports specific definitions. Everything else reads
// the mounted room through currentRoom() or useRoomDef().
export const rooms: Readonly<Record<string, RoomDef>> = {
  [level0.id]: level0,
  [level1.id]: level1,
  [level2.id]: level2,
}

// Level 0 until Level 1 is done, then the hall.
export const DEFAULT_ROOM = level0.id

let active: RoomDef | null = null

// The room chosen by ?room=. Fixed for the life of the page: switching rooms reloads.
export function currentRoom(): RoomDef {
  if (active) return active
  const id =
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('room')
  if (id && !rooms[id]) console.warn(`[room] unknown room "${id}", using ${DEFAULT_ROOM}`)
  active = (id && rooms[id]) || rooms[DEFAULT_ROOM]
  return active
}
