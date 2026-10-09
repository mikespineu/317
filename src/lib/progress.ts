// What the player has finished, kept in this browser's localStorage: per
// room, the best time, stars and photograph of each ghost. A convenience
// only; anything that counts (leaderboards) has to be validated by the server.
const STORAGE_KEY = '317:progress:v1'

export interface SavedPhoto {
  ghostId: string
  score: number
  image: string | null // a JPEG data URL; null when it could not be stored
}

export interface RoomProgress {
  completedAt: string // ISO date of the latest run
  runs: number
  bestSeconds: number | null
  stars: number | null // best count; null for a room that awards none
  score: number // the best photographs' scores, added up
  photos: SavedPhoto[] // the best one per ghost, over every run
  leads: string[] // tokens of the hints this room has given to other rooms, over every run
}

export interface Progress {
  rooms: Record<string, RoomProgress>
}

// One finished run, before it is merged with what is already saved.
export interface RoomRun {
  seconds: number | null
  stars: number | null
  photos: SavedPhoto[]
  leads?: string[]
}

export function loadProgress(): Progress {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (saved && typeof saved.rooms === 'object' && saved.rooms) return saved as Progress
  } catch {
    // Storage is blocked or the entry is damaged: start clean.
  }
  return { rooms: {} }
}

const least = (a: number | null, b: number | null) =>
  a === null ? b : b === null ? a : Math.min(a, b)
const most = (a: number | null, b: number | null) =>
  a === null ? b : b === null ? a : Math.max(a, b)

function store(progress: Progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

// Merges a run into the saved progress, keeping the best of each part.
export function recordRoom(roomId: string, run: RoomRun): RoomProgress {
  const progress = loadProgress()
  const before = progress.rooms[roomId]

  const photos = [...(before?.photos ?? [])]
  for (const photo of run.photos) {
    const at = photos.findIndex((p) => p.ghostId === photo.ghostId)
    if (at < 0) photos.push(photo)
    else if (photo.score > photos[at].score) photos[at] = photo
  }

  const room: RoomProgress = {
    completedAt: new Date().toISOString(),
    runs: (before?.runs ?? 0) + 1,
    bestSeconds: least(before?.bestSeconds ?? null, run.seconds),
    stars: most(before?.stars ?? null, run.stars),
    score: photos.reduce((sum, p) => sum + p.score, 0),
    photos,
    leads: [...new Set([...(before?.leads ?? []), ...(run.leads ?? [])])],
  }
  progress.rooms[roomId] = room
  try {
    store(progress)
  } catch {
    // Most likely the quota: the pictures are the only large part.
    try {
      room.photos = photos.map((p) => ({ ...p, image: null }))
      store(progress)
    } catch {
      // Storage is not available at all; the run is simply not kept.
    }
  }
  return room
}

// A photograph's object URL as a data URL, which outlives the page.
export async function imageDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// --- Battery carried into the next room ------------------------------------
// The next room is another page load, so the flashlight's charge and the spare
// packs cross in sessionStorage. It is kept for the tab's session and tied to
// the room it was carried into, so "Play again" there starts the same way.
const CARRY_KEY = '317:carry:v1'

export interface CarriedBattery {
  charge: number // 0..1
  spares: number
}

export function carryBattery(roomId: string, battery: CarriedBattery) {
  try {
    sessionStorage.setItem(CARRY_KEY, JSON.stringify({ roomId, ...battery }))
  } catch {
    // No storage: the next room starts with its own battery.
  }
}

export function carriedBattery(roomId: string): CarriedBattery | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CARRY_KEY) ?? 'null')
    if (saved?.roomId !== roomId) return null
    const { charge, spares } = saved
    if (!Number.isFinite(charge) || !Number.isFinite(spares)) return null
    return {
      charge: Math.min(1, Math.max(0, charge)),
      spares: Math.max(0, Math.floor(spares)),
    }
  } catch {
    return null
  }
}
