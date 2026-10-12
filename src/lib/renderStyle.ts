// Which look the game is drawn in: the woodblock print or ASCII. Picked on the
// title screen and kept in localStorage; ?style=print|ascii overrides it for
// one visit. No three.js here, so the title route can import it.
const STORAGE_KEY = '317:style:v1'

export const RENDER_STYLES = ['print', 'ascii'] as const
export type RenderStyle = (typeof RENDER_STYLES)[number]

const isStyle = (v: unknown): v is RenderStyle => RENDER_STYLES.includes(v as RenderStyle)

export function getRenderStyle(): RenderStyle {
  if (typeof window === 'undefined') return 'print'
  const forced = new URLSearchParams(window.location.search).get('style')
  if (isStyle(forced)) return forced
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isStyle(saved)) return saved
  } catch {
    // Storage is blocked: fall through to the default.
  }
  return 'print'
}

export function setRenderStyle(style: RenderStyle) {
  try {
    localStorage.setItem(STORAGE_KEY, style)
  } catch {
    // Not saved; the choice lasts until the page is left.
  }
}
