import { createContext, use } from 'react'
import type { ReactNode } from 'react'
import type { RoomDef } from './roomDef'
import { currentRoom } from './rooms'

const DefContext = createContext<RoomDef | null>(null)

export function RoomProvider({ def, children }: { def: RoomDef; children?: ReactNode }) {
  return <DefContext value={def}>{children}</DefContext>
}

// The mounted room's definition. Outside the provider (the DOM overlays, and
// modules that run outside React) it is the room chosen by the URL, which is
// the same one.
export function useRoomDef(): RoomDef {
  return use(DefContext) ?? currentRoom()
}
