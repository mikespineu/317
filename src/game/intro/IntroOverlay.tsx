import { useEffect, useRef } from 'react'
import { useRoomDef } from '../room/RoomContext'
import { useGame } from '../store'
import { bindIntroView } from './introView'
import './intro.css'

// DOM half of the intro: the dip to near-black after the slam, and the line
// asking for the first gesture (audio cannot start without one). It never
// takes input; Intro.tsx drives it through introView.
export function IntroOverlay() {
  const def = useRoomDef()
  const touch = useGame((s) => s.touch)
  const wash = useRef<HTMLDivElement>(null)
  const prompt = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    bindIntroView(wash.current, prompt.current)
    return () => bindIntroView(null, null)
  }, [])

  if (!def.intro) return null
  return (
    <div className="intro" aria-hidden>
      <div ref={wash} className="intro-wash" />
      <p ref={prompt} className="intro-prompt print-ink" hidden>
        {touch ? 'Tap to begin' : 'Click or press a key to begin'}
      </p>
    </div>
  )
}
