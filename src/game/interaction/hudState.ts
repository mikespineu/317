import { create } from 'zustand'
import { tuning } from '../tuning'

// Small UI-only state shared by the actions, the HUD and the padlock. It is
// not game state, so it stays out of the main store.
interface HudState {
  message: string | null
  messageId: number // bumps on every message so the HUD can restart its fade
  lockNode: string | null // the interactable whose lock the padlock UI is editing
}

export const useHud = create<HudState>(() => ({ message: null, messageId: 0, lockNode: null }))

let timer: ReturnType<typeof setTimeout> | undefined

// Shows a short line under the prompt, e.g. "Locked. It needs a key."
export function showMessage(text: string) {
  useHud.setState((s) => ({ message: text, messageId: s.messageId + 1 }))
  clearTimeout(timer)
  timer = setTimeout(() => useHud.setState({ message: null }), tuning.messageSeconds * 1000)
}
