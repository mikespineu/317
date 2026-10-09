import { useRoomDef } from '../room/RoomContext'
import { Mimic } from './Mimic'
import { Wisp } from './Wisp'

// One component per ghost in the definition. Disabled entries (return-visit
// content) are skipped.
export function Ghosts() {
  const def = useRoomDef()
  return (
    <>
      {def.ghosts.map((ghost, index) => {
        if (ghost.enabled === false) return null
        if (ghost.type === 'mimic') return <Mimic key={ghost.id} ghost={ghost} />
        return <Wisp key={ghost.id} ghost={ghost} seed={index} />
      })}
    </>
  )
}
