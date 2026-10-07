import { create } from 'zustand'
import { resetRuntime, runtime } from './runtime'
import { tuning } from './tuning'

export type LightMode = 'white' | 'uv'
export type BatteryLevel = 'full' | 'medium' | 'low' | 'empty'
export type UiLock = 'padlock' | 'photo' | 'complete' | null

export interface PhotoParts {
  lit: number
  framed: number
  close: number
  sharp: number
}

export interface Photo {
  ghostId: string
  score: number
  parts: PhotoParts
  url: string
}

// The most recent shot, with or without a ghost in it; drives the photo card.
export interface Shot {
  url: string
  ghostId: string | null
  score: number | null
  parts: PhotoParts | null
  best: boolean
}

export function levelOf(charge: number): BatteryLevel {
  if (charge >= tuning.levelFull) return 'full'
  if (charge >= tuning.levelMedium) return 'medium'
  return charge > 0 ? 'low' : 'empty'
}

// The store changes only on events (a key press, a pickup, a level crossed).
// Anything that changes every frame lives in runtime.ts; the live battery
// charge is runtime.battery.charge, and batteryLevel here follows it.
export interface GameState {
  // light
  lightOn: boolean
  lightMode: LightMode
  switching: boolean // short delay while swapping modes, light is off
  batteryLevel: BatteryLevel
  spares: number // spare packs in the inventory
  swapping: boolean // swap in progress, light is off

  // items, flags, clues: keys are stored without the 'item:' / 'flag:' /
  // 'clue:' prefixes used in the room definition
  items: Record<string, number>
  flags: Record<string, boolean>
  clues: string[]
  pickedUp: Record<string, boolean> // by Pickup_ node name

  // interaction
  focus: string | null // node name under the crosshair
  uiLock: UiLock
  paused: boolean // pointer lock lost on desktop, or portrait on a phone

  // camera
  cameraRaised: boolean
  photos: Photo[] // best photo per ghost
  lastShot: Shot | null

  // environment
  backend: 'webgpu' | 'webgl2' | null
  touch: boolean // the player is using touch controls
  epoch: number // bumped by resetLevel; the scene remounts when it changes

  // actions
  toggleLight(): void
  toggleMode(): void
  swapBattery(): void
  setBatteryLevel(level: BatteryLevel): void
  addItem(id: string): void
  removeItem(id: string): void
  setFlag(id: string, value?: boolean): void
  addClue(id: string): void
  setPickedUp(node: string, value: boolean): void
  setFocus(node: string | null): void
  setUiLock(lock: UiLock): void
  setPaused(paused: boolean): void
  setCameraRaised(raised: boolean): void
  addShot(shot: Omit<Shot, 'best'>): void
  setBackend(backend: 'webgpu' | 'webgl2'): void
  setTouch(touch: boolean): void
  resetLevel(): void
}

// Everything a level restart puts back. Environment fields (backend, touch,
// paused) are left alone.
const initialLevelState = () => ({
  lightOn: true,
  lightMode: 'white' as LightMode,
  switching: false,
  batteryLevel: levelOf(tuning.startCharge),
  spares: 0,
  swapping: false,
  items: {} as Record<string, number>,
  flags: {} as Record<string, boolean>,
  clues: [] as string[],
  pickedUp: {} as Record<string, boolean>,
  focus: null,
  uiLock: null,
  cameraRaised: false,
  photos: [] as Photo[],
  lastShot: null,
})

export const useGame = create<GameState>((set, get) => ({
  ...initialLevelState(),
  paused: false,

  backend: null,
  touch: false,
  epoch: 0,

  toggleLight: () => set((s) => ({ lightOn: !s.lightOn })),

  toggleMode: () => {
    if (get().switching) return
    const { epoch } = get()
    set({ switching: true })
    setTimeout(() => {
      if (get().epoch !== epoch) return // the level was reset meanwhile
      set((s) => ({
        switching: false,
        lightMode: s.lightMode === 'white' ? 'uv' : 'white',
      }))
    }, tuning.modeSwitchDelay * 1000)
  },

  swapBattery: () => {
    const { spares, swapping, epoch } = get()
    if (swapping || spares <= 0) return
    set({ swapping: true })
    setTimeout(() => {
      if (get().epoch !== epoch) return // the level was reset meanwhile
      runtime.battery.charge = 1
      set((s) => ({ swapping: false, spares: s.spares - 1, batteryLevel: 'full' }))
    }, tuning.swapSeconds * 1000)
  },

  setBatteryLevel: (batteryLevel) => set({ batteryLevel }),

  // Battery packs count as spares; everything else is a plain item.
  addItem: (id) =>
    set((s) =>
      id === 'battery'
        ? { spares: s.spares + 1 }
        : { items: { ...s.items, [id]: (s.items[id] ?? 0) + 1 } },
    ),
  removeItem: (id) =>
    set((s) => ({ items: { ...s.items, [id]: Math.max(0, (s.items[id] ?? 0) - 1) } })),
  setFlag: (id, value = true) => set((s) => ({ flags: { ...s.flags, [id]: value } })),
  addClue: (id) => set((s) => (s.clues.includes(id) ? s : { clues: [...s.clues, id] })),
  setPickedUp: (node, value) => set((s) => ({ pickedUp: { ...s.pickedUp, [node]: value } })),

  setFocus: (focus) => {
    if (get().focus !== focus) set({ focus })
  },
  setUiLock: (uiLock) => set({ uiLock }),
  setPaused: (paused) => {
    if (get().paused !== paused) set({ paused })
  },
  setCameraRaised: (cameraRaised) => set({ cameraRaised }),

  // Keeps only the best photo per ghost; lastShot always shows the new one.
  addShot: (shot) =>
    set((s) => {
      const { ghostId, score, parts, url } = shot
      if (ghostId === null || score === null || parts === null)
        return { lastShot: { ...shot, best: false } }
      const prev = s.photos.find((p) => p.ghostId === ghostId)
      const best = !prev || score > prev.score
      const photo: Photo = { ghostId, score, parts, url }
      return {
        lastShot: { ...shot, best },
        photos: best ? [...s.photos.filter((p) => p.ghostId !== ghostId), photo] : s.photos,
      }
    }),

  setBackend: (backend) => set({ backend }),
  setTouch: (touch) => {
    if (get().touch !== touch) set({ touch })
  },

  // Restarts the level without reloading the page, so live tuning survives.
  // Level0 is keyed on epoch: the room reloads and every system remounts.
  resetLevel: () => {
    resetRuntime()
    set((s) => ({ ...initialLevelState(), epoch: s.epoch + 1 }))
  },
}))
