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
    { node: 'Pickup_Battery', item: 'battery' },
    { node: 'Pickup_Battery_Desk', item: 'battery' },
    { node: 'Pickup_Key', item: 'key', visibleWhen: 'flag:drawer-open' },
  ],
  ghosts: [{ id: 'wisp-1', type: 'wisp', mesh: 'Wisp', spawn: 'Spawn_Wisp', baseScore: 100 }],
  mirror: { node: 'Mirror_Surface' },
  exit: { node: 'Interact_Door', requires: 'item:key' },
} as const

export type RoomDef = typeof level0
