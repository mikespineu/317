import { useEffect } from 'react'
import { useT } from '#/i18n'

// The About sheet, laid over whatever opened it (the title screen, the pause
// card, the room-complete card), so the game underneath keeps its state.
export function AboutOverlay({ onClose }: { onClose(): void }) {
  const t = useT()

  useEffect(() => {
    // Capture phase on window: the game's own key bindings never see these.
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation()
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('about.title')}
      className="pointer-events-auto fixed inset-0 z-[200] grid cursor-default place-items-center bg-ink/90 p-4 text-center font-display"
      onClick={onClose}
    >
      <article
        className="print-paper grid min-w-[min(20rem,100%)] justify-items-center gap-6 px-10 py-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="m-0 text-4xl font-bold tracking-[0.04em]">{t('about.title')}</h2>
        <button
          type="button"
          className="cursor-pointer border-2 border-ink bg-vermilion px-6 py-2 text-sm font-bold tracking-[0.16em] text-paper uppercase shadow-[0.2em_0.2em_0_var(--color-ink)] hover:bg-saffron hover:text-ink"
          onClick={onClose}
        >
          {t('about.close')}
        </button>
      </article>
    </div>
  )
}
