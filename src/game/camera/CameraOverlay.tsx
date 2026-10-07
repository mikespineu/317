import { useEffect, useRef } from 'react'
import { useGame } from '../store'
import { onFlash } from './cameraFx'
import './camera-overlay.css'

const FLASH_MS = 150

// Viewfinder while the camera is raised, and the white flash on a shot.
export function CameraOverlay() {
  const raised = useGame((s) => s.cameraRaised)
  const locked = useGame((s) => s.uiLock !== null)
  const flashEl = useRef<HTMLDivElement>(null)
  const coolEl = useRef<HTMLDivElement>(null)

  useEffect(
    () =>
      onFlash((cooldownSeconds) => {
        // A softer flash for players who asked for reduced motion.
        const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        flashEl.current?.animate([{ opacity: calm ? 0.3 : 0.95 }, { opacity: 0 }], {
          duration: FLASH_MS,
          easing: 'ease-out',
        })
        // The bar empties while the shutter recharges.
        coolEl.current?.animate(
          [
            { transform: 'scaleX(1)', opacity: 1 },
            { transform: 'scaleX(0)', opacity: 1 },
          ],
          { duration: cooldownSeconds * 1000, easing: 'linear' },
        )
      }),
    [],
  )

  return (
    <div className={`viewfinder${raised && !locked ? ' is-raised' : ''}`} aria-hidden="true">
      <div className="viewfinder-shade" />
      <div className="viewfinder-frame">
        <i className="viewfinder-corner is-tl" />
        <i className="viewfinder-corner is-tr" />
        <i className="viewfinder-corner is-bl" />
        <i className="viewfinder-corner is-br" />
        <div className="viewfinder-centre" />
        <div className="viewfinder-cooldown">
          <div className="viewfinder-cooldown-fill" ref={coolEl} />
        </div>
      </div>
      <div className="viewfinder-flash" ref={flashEl} />
    </div>
  )
}
