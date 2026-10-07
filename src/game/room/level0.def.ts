// Hand-written room definition, shaped like the JSON the room loader will read
// later (see the GDD). Tokens: 'item:x', 'flag:x', 'clue:x'.
export const level0 = {
  id: 'level-0',
  scene: '/models/level0/level-0.glb',
  spawn: 'Spawn_Player',
  interactables: [
    { node: 'Interact_Painting_Canvas', type: 'uv-reveal', gives: ['clue:drawer-code'] },
    {
      node: 'Interact_Desk_Drawer',
      type: 'drawer',
      slide: 0.35,
      // The code is a placeholder; any short code works.
      lock: { type: 'code', code: '3-1-7', mesh: 'Desk_Padlock', sets: 'flag:drawer-unlocked' },
      sets: 'flag:drawer-open',
    },
    { node: 'Interact_Door', type: 'door', requires: 'item:key', openAngleDeg: 95 },
  ],
  pickups: [
    // The flashlight starts on the floor. It has no node in level-0.glb: an
    // entry with a `model` is loaded and placed by the room loader, so it can
    // be moved here without opening Blender.
    {
      node: 'Pickup_Flashlight',
      item: 'flashlight',
      model: '/models/level0/flashlight.glb',
      at: [0.35, 0.042, 1.15], // metres; the model's origin is its axis, 4 cm up
      yawDeg: 35,
      glow: true, // a faint warm light so it can be found in the dark
    },
    { node: 'Pickup_Battery', item: 'battery' },
    { node: 'Pickup_Battery_Desk', item: 'battery' },
    { node: 'Pickup_Key', item: 'key', visibleWhen: 'flag:drawer-open' },
  ],
  // Loose scenery that is more than set dressing. `throwable: true` makes a
  // prop grabbable (E / click) and throwable (E / click again) with the prop
  // physics. Without it the entry is only a named scenery object.
  props: [
    { node: 'Book_1', label: 'book', throwable: true },
    { node: 'Book_2', label: 'book', throwable: true },
    { node: 'Book_3', label: 'book', throwable: true },
    { node: 'Book_4', label: 'book', throwable: true },
  ],
  ghosts: [{ id: 'wisp-1', type: 'wisp', mesh: 'Wisp', spawn: 'Spawn_Wisp', baseScore: 100 }],
  mirror: { node: 'Mirror_Surface' },
  exit: { node: 'Interact_Door', requires: 'item:key' },
} as const

export type RoomDef = typeof level0
