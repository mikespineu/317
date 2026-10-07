import { useRoomDef } from '../room/RoomContext'
import { Wisp } from './Wisp'

// One component per ghost in the definition. Disabled entries (return-visit
// content) are skipped.
export function Ghosts() {
  const def = useRoomDef()
  return (
    <>
      {def.ghosts.map((ghost, index) =>
        ghost.type === 'wisp' && ghost.enabled !== false ? (
          <Wisp key={ghost.id} ghost={ghost} seed={index} />
        ) : null,
      )}
    </>
  )
}
