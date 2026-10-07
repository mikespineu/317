// Overlay toggles shared between the debug panel (writer) and DebugScene
// (reader, every frame). Plain mutable object: nothing here needs a render.
export const debugState = {
  showStats: true,
  showColliders: false,
  showBeam: false,
  mirrorOnlyInMainView: false, // MirrorOnly_ meshes drawn in the main view too
  showGhostZones: false,
}

export type DebugState = typeof debugState
