export interface Quality {
  name: 'desktop' | 'phone'
  dpr: number // device pixel ratio cap
  msaa: boolean
  shadowMap: number // flashlight shadow map size
  mirrorScale: number // mirror resolution as a fraction of the screen
  dust: number // dust particle count
  bloomScale: number // bloom resolution as a fraction of the screen
  grain: boolean
}

const presets: Record<Quality['name'], Quality> = {
  desktop: {
    name: 'desktop',
    dpr: 2,
    msaa: true,
    shadowMap: 1024,
    mirrorScale: 0.5,
    dust: 400,
    bloomScale: 1,
    grain: true,
  },
  phone: {
    name: 'phone',
    dpr: 1.5,
    msaa: false,
    shadowMap: 512,
    mirrorScale: 0.35,
    dust: 150,
    bloomScale: 0.5,
    grain: false,
  },
}

// Picked once at load. ?quality=phone|desktop overrides the detection.
function detect(): Quality {
  const forced = new URLSearchParams(window.location.search).get('quality')
  if (forced === 'phone' || forced === 'desktop') return presets[forced]
  const coarse = window.matchMedia('(pointer: coarse)').matches
  return presets[coarse ? 'phone' : 'desktop']
}

export const quality = detect()
