import type { RoomDef } from './roomDef'

// The Level 0 study. Hand-written, shaped like the JSON the room loader will
// read later (see roomDef.ts).
export const level0 = {
  id: 'level-0',
  title: { en: 'The Study', pl: 'Gabinet' },
  scene: '/models/level0/level-0.glb',
  spawn: 'Spawn_Player',
  atmosphere: {
    // The window on the north wall (-Z) and where the moon sits behind it.
    window: { x: 0, y: 1.6, z: -2.58, w: 1.06, h: 1.06, facing: 'north' },
    moon: [-1.1, 4.4, -6.2],
  },
  interactables: [
    { node: 'Interact_Painting_Canvas', type: 'uv-reveal', gives: ['clue:drawer-code'] },
    {
      node: 'Interact_Desk_Drawer',
      type: 'drawer',
      slide: 0.35,
      // The code is a placeholder; any short code works.
      lock: { type: 'code', code: '3-1-7', mesh: 'Desk_Padlock', sets: 'flag:drawer-unlocked' },
      codeNote: {
        en: 'Code found. Try the desk drawer.',
        pl: 'Szyfr znaleziony. Sprawdź szufladę biurka.',
      },
      sets: 'flag:drawer-open',
    },
    { node: 'Interact_Door', type: 'door', requires: 'item:key', openAngleDeg: 95 },
    // Named by the definition rather than by an Interact_ prefix, so no re-export is needed.
    { node: 'Prop_Candle', type: 'candle' },
  ],
  pickups: [
    // The flashlight starts on the floor. It has no node in level-0.glb: an
    // entry with a `model` is loaded and placed by the room loader, so it can
    // be moved here without opening Blender.
    {
      node: 'Pickup_Flashlight',
      item: 'flashlight',
      model: '/models/shared/flashlight.glb',
      at: [0.35, 0.042, 1.15], // metres; the model's origin is its axis, 4 cm up
      yawDeg: 35,
      glow: true,
    },
    { node: 'Pickup_Battery', item: 'battery' },
    { node: 'Pickup_Battery_Desk', item: 'battery' },
    { node: 'Pickup_Key', item: 'key', visibleWhen: 'flag:drawer-open' },
  ],
  props: [
    { node: 'Book_1', label: { en: 'book', pl: 'książkę' }, throwable: true },
    { node: 'Book_2', label: { en: 'book', pl: 'książkę' }, throwable: true },
    { node: 'Book_3', label: { en: 'book', pl: 'książkę' }, throwable: true },
    { node: 'Book_4', label: { en: 'book', pl: 'książkę' }, throwable: true },
  ],
  ghosts: [{ id: 'wisp-1', type: 'wisp', mesh: 'Wisp', spawn: 'Spawn_Wisp', baseScore: 100 }],
  mirror: { node: 'Mirror_Surface', testWord: { en: 'AWAKE', pl: 'CZUWAJ' } },
  emergencyPack: { pickup: 'Pickup_Battery' },
  // Find the light, then (until the painting's code is found) learn about UV.
  guide: [
    {
      id: 'find-light',
      unless: 'light:held',
      delay: 0,
      text: {
        en: 'Too dark to see. Find the flashlight on the floor and press **E** to pick it up.',
        pl: 'Za ciemno, by coś widzieć. Znajdź latarkę na podłodze i naciśnij **E**, aby ją podnieść.',
      },
      touchText: {
        en: 'Too dark to see. Find the flashlight on the floor and tap it.',
        pl: 'Za ciemno, by coś widzieć. Znajdź latarkę na podłodze i dotknij jej.',
      },
    },
    {
      id: 'uv-sweep',
      when: ['light:held', 'uv:on'],
      unless: 'clue:drawer-code',
      delay: 0,
      text: {
        en: 'The UV light shows what the eye cannot. Sweep it slowly across the walls.',
        pl: 'Światło UV pokazuje to, czego oko nie widzi. Przesuwaj je powoli po ścianach.',
      },
    },
    {
      // Waits a while after the flashlight is found, so the player looks around first.
      id: 'uv-switch',
      when: 'light:held',
      unless: 'clue:drawer-code',
      delay: 20,
      delayKey: 'uvHintDelay',
      text: {
        en: 'Something may be hidden in this room. Press **Q** for UV light, then sweep the walls.',
        pl: 'W tym pokoju może być coś ukrytego. Naciśnij **Q**, aby włączyć światło UV, i oświetl ściany.',
      },
      touchText: {
        en: 'Something may be hidden in this room. Tap the UV button, then sweep the walls.',
        pl: 'W tym pokoju może być coś ukrytego. Dotknij przycisku UV i oświetl ściany.',
      },
    },
  ],
  debugSkips: [
    { label: 'clue found', give: ['clue:drawer-code'] },
    { label: 'drawer unlocked', unlock: 'Interact_Desk_Drawer', give: ['flag:drawer-unlocked'] },
    { label: 'drawer open', use: 'Interact_Desk_Drawer', give: ['flag:drawer-open'] },
    { label: 'key in inventory', take: 'Pickup_Key' },
  ],
  exit: { node: 'Interact_Door', requires: 'item:key' },
  nextRoom: 'entrance-hall',
  complete: {
    eyebrow: { en: '3.17 · the study', pl: '3.17 · gabinet' },
    title: { en: 'Level complete', pl: 'Poziom ukończony' },
    line: {
      en: 'The lock turns. Cold air from the hallway.',
      pl: 'Zamek ustępuje. Z korytarza wieje chłodem.',
    },
  },
} satisfies RoomDef
