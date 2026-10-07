// The intro's two DOM pieces: the wash of ink that dips the picture to black
// and the "tap to begin" line. Intro (in the scene) writes here every frame;
// IntroOverlay (in the DOM) binds its elements. No three, no React state.

const DARKEST = 0.94 // near-black: the moonlit floor stays just readable
const STEPS = 4 // the dip moves in blocks, like every other animation in the UI

let wash: HTMLElement | null = null
let prompt: HTMLElement | null = null
let dark = 0
let asking = false

function paint() {
  if (wash) wash.style.opacity = String((Math.round(dark * STEPS) / STEPS) * DARKEST)
  if (prompt) prompt.hidden = !asking
}

export function bindIntroView(washEl: HTMLElement | null, promptEl: HTMLElement | null) {
  wash = washEl
  prompt = promptEl
  paint()
}

// `darkness` is 0..1; `ask` shows the prompt for the first gesture.
export function setIntroView(darkness: number, ask: boolean) {
  const next = Math.min(1, Math.max(0, darkness))
  if (next === dark && ask === asking) return
  dark = next
  asking = ask
  paint()
}
