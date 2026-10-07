import { useEffect, useRef } from 'react'
import { useRoomDef } from '../room/RoomContext'
import { useGame } from '../store'
import './note.css'

// The tap or click that picked the note up is followed by its own click on
// whatever is now under the pointer; nothing dismisses the note this early.
const OPEN_GUARD_MS = 300

// A note the player has picked up, shown as a sheet of paper. The store takes
// the 'note' UI lock with openNote; the input module releases and restores
// pointer lock from that, as for the padlock.
export function NoteUI() {
  const id = useGame((s) => s.openNote)
  const touch = useGame((s) => s.touch)
  const note = useRoomDef().notes?.[id ?? '']
  const openedAt = useRef(0)

  const dismiss = () => {
    if (performance.now() - openedAt.current < OPEN_GUARD_MS) return
    useGame.getState().setOpenNote(null)
  }

  useEffect(() => {
    if (!id) return
    openedAt.current = performance.now()
    // Capture phase on window: the game's own key bindings never see these.
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation()
      // A held E (the press that picked the note up) must not close it.
      if (e.repeat) return
      if (e.key === 'Escape' || e.key === 'Enter' || e.code === 'KeyE' || e.code === 'Space') {
        e.preventDefault()
        dismiss()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [id])

  if (!id || !note) return null
  return (
    <div
      className="note-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={note.title}
      onClick={dismiss}
    >
      <article className="note print-paper">
        <h2 className="note-title">{note.title}</h2>
        {note.body.map((line, i) => (
          <p key={i} className="note-line">
            {line}
          </p>
        ))}
        <button type="button" className="note-close" onClick={dismiss}>
          Put it away
        </button>
      </article>
      {!touch && (
        <p className="note-hint">
          <kbd>E</kbd> or <kbd>Esc</kbd> put it away
        </p>
      )}
    </div>
  )
}
