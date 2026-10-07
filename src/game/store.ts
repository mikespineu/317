import { create } from 'zustand'

export type LightMode = 'white' | 'uv'

type GameState = {
  lightOn: boolean
  lightMode: LightMode
  toggleLight: () => void
  switchLightMode: () => void
}

export const useGame = create<GameState>((set) => ({
  lightOn: true,
  lightMode: 'white',
  toggleLight: () => set((s) => ({ lightOn: !s.lightOn })),
  switchLightMode: () =>
    set((s) => ({ lightMode: s.lightMode === 'white' ? 'uv' : 'white' })),
}))
