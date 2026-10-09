import type { RoomDef } from './roomDef'

// Room 2, the Library. North (Blender +Y) is three.js -Z: a yaw of 0 looks at
// the fireplace and the service door. See docs/level-2-implementation.md.
const MARKED = ['A', 'B', 'C', 'D'] as const

export const level2 = {
  id: 'library',
  title: { en: 'The Library', pl: 'Biblioteka' },
  scene: '/models/level2/level-2.glb',
  spawn: 'Spawn_Player',
  spawnYawDeg: 0,
  lights: { uv: 'lamp' }, // the UV switch stays off until the lamp is picked up
  startsWithLight: true, // the flashlight came from the hall; a deep link still has it
  startCharge: 0.5, // the battery carried from the hall wins over this
  parSeconds: 540,
  bounds: { halfX: 3.0, halfZ: 4.0, ceiling: 3.2 },

  atmosphere: {
    // The arched window in the east wall (the glass in level-2.glb).
    window: { x: 3.0, y: 1.67, z: -0.4, w: 1.24, h: 2.18, facing: 'east' },
    moon: [9.0, 6.0, -1.5], // behind the window; the patch falls toward the table
    fogScale: 0.7,
    roomTone: 'library',
  },

  interactables: [
    {
      node: 'Interact_Ledger',
      type: 'read',
      name: { en: 'ledger', pl: 'rejestr wypożyczeń' },
      note: 'ledger',
    },
    {
      node: 'Interact_Hollow_Dictionary',
      type: 'search',
      name: { en: 'dictionary', pl: 'słownik' },
      gives: ['item:battery'],
      sets: 'flag:dictionary-searched',
      line: {
        en: 'The pages are cut out. A battery pack inside.',
        pl: 'Strony są wycięte. W środku bateria.',
      },
    },
    { node: 'Prop_Candle', type: 'candle' },
    {
      // Hinged on its south edge with the leaf along -Z: a negative angle swings it out into the room.
      node: 'Interact_Hidden_Panel',
      type: 'lid',
      name: { en: 'panel', pl: 'panel' },
      hingeAxis: 'y',
      openAngleDeg: -100,
      // The lock sits between the second and third of the four books in front of it.
      availableWhen: ['flag:moved:Prop_PanelBook_2', 'flag:moved:Prop_PanelBook_3'],
      lock: { type: 'code', code: '7-2-0-5', mesh: 'Hidden_Panel_Lock', sets: 'flag:panel-unlocked' },
      sets: 'flag:panel-open',
    },
    {
      // Hinge on the west edge, leaf along +X: positive swings it north, into the dark vestibule.
      node: 'Interact_Service_Door',
      type: 'door',
      requires: 'item:kitchen-key',
      openAngleDeg: -95,
      moves: [{ node: 'Ladder', by: [-0.9, 0, 0], collider: 'Collider_Ladder' }],
    },
  ],

  pickups: [
    { node: 'Pickup_Battery_Desk', item: 'battery' },
    { node: 'Pickup_Battery_Dictionary', item: 'battery', hidden: true }, // given by the search, never shown
    { node: 'Pickup_Battery_Panel', item: 'battery', visibleWhen: 'flag:panel-open' },
    { node: 'Pickup_Kitchen_Key', item: 'kitchen-key', visibleWhen: 'flag:panel-open' },
    { node: 'Pickup_Diary_Page', item: 'diary-page', visibleWhen: 'flag:panel-open', note: 'diary' },
    {
      // Not in level-2.glb: placed by the loader, shown and dropped by the Mimic.
      node: 'Pickup_UV_Lamp',
      item: 'uv-lamp',
      model: '/models/shared/uv-lamp.glb',
      at: [-0.1, 0.79, -0.15],
      yawDeg: 0,
      glow: true,
      visibleWhen: 'flag:mimic-caught',
    },
  ],

  props: [
    ...MARKED.map((id) => ({
      node: `Prop_MarkedBook_${id}`,
      label: { en: 'book', pl: 'książkę' },
      throwable: true as const,
    })),
    ...[1, 2, 3, 4].map((n) => ({
      node: `Prop_PanelBook_${n}`,
      label: { en: 'book', pl: 'książkę' },
      throwable: true as const,
    })),
    { node: 'Prop_Fallen_Book', label: { en: 'book', pl: 'książkę' }, throwable: true },
  ],

  ghosts: [
    {
      id: 'mimic',
      type: 'mimic',
      mesh: 'Mimic_True',
      spawn: 'Spawn_Mimic_1',
      baseScore: 150,
      key: true,
      spots: [
        { spawn: 'Spawn_Mimic_1', decoy: 'Decoy_Book_1', disguise: 'Mimic_Book' },
        { spawn: 'Spawn_Mimic_2', decoy: 'Decoy_Book_2', disguise: 'Mimic_Book' },
        { spawn: 'Spawn_Mimic_3', decoy: 'Decoy_Book_3', disguise: 'Mimic_Book' },
        { spawn: 'Spawn_Mimic_4', decoy: 'Decoy_Book_4', disguise: 'Mimic_Book' },
        { spawn: 'Spawn_Mimic_5', decoy: 'Decoy_Stool', disguise: 'Mimic_Stool' },
      ],
      drops: { pickup: 'Pickup_UV_Lamp', sets: 'flag:mimic-caught' },
    },
    {
      id: 'ink',
      type: 'ink',
      mesh: 'Ink_Ghost',
      spawn: 'Spawn_InkGhost',
      baseScore: 200,
      whisper: 'penScratch',
      route: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `Path_InkGhost_0${n}`),
    },
  ],

  // Ink that shows only inside the UV cone. The handprints log one shared
  // clue; each digit logs its own, named for the stack it is on.
  uvText: [
    {
      node: 'UVOnly_Message',
      art: 'message',
      text: { en: 'The hall remembers what the clock forgot.', pl: 'Hol pamięta to, co zegar zapomniał.' },
      gives: 'clue:hall-message',
    },
    { node: 'UVOnly_Handprint_A', art: 'hand', gives: 'clue:handprints' },
    { node: 'UVOnly_Handprint_B', art: 'hand', flip: true, gives: 'clue:handprints' },
    { node: 'UVOnly_Handprint_C', art: 'hand', gives: 'clue:handprints' },
    { node: 'UVOnly_Handprint_D', art: 'hand', flip: true, gives: 'clue:handprints' },
    { node: 'UVOnly_Digit_A', art: 'digit', digit: '2', gives: 'clue:library-digit-a' },
    { node: 'UVOnly_Digit_B', art: 'digit', digit: '5', gives: 'clue:library-digit-b' },
    { node: 'UVOnly_Digit_C', art: 'digit', digit: '7', gives: 'clue:library-digit-c' },
    { node: 'UVOnly_Digit_D', art: 'digit', digit: '0', gives: 'clue:library-digit-d' },
  ],

  notes: {
    ledger: {
      title: { en: 'Lending ledger', pl: 'Rejestr wypożyczeń' },
      body: [
        {
          en: 'The last entry is struck out. Beside it, in a hurry:',
          pl: 'Ostatni wpis jest przekreślony. Obok, w pośpiechu:',
        },
        {
          en: 'The reading lamp is kept where the books keep their secrets.',
          pl: 'Lampa do czytania leży tam, gdzie księgi chowają swoje tajemnice.',
        },
        {
          en: 'Always read the stacks from the top shelf down.',
          pl: 'Regały czytaj zawsze od najwyższej półki w dół.',
        },
      ],
      gives: 'clue:read-top-down',
    },
    diary: {
      title: { en: 'A page from a diary', pl: 'Kartka z pamiętnika' },
      body: [
        {
          en: 'He asked me to stop every clock, so the night would not end.',
          pl: 'Kazał mi zatrzymać każdy zegar, żeby noc się nie skończyła.',
        },
        { en: 'I did. Something laughed on the stairs,', pl: 'Zrobiłam to. Coś zaśmiało się na schodach,' },
        { en: 'and then it was always 3:17.', pl: 'a potem zawsze była 3:17.' },
      ],
      gives: 'flag:diary-found',
    },
  },

  emergencyPack: { pickup: 'Pickup_Battery_Desk', spawn: 'Spawn_Battery_Emergency' },

  // One nudge per phase of the chain. A step above another on the same
  // condition replaces it.
  guide: [
    {
      id: 'service-door',
      when: 'item:kitchen-key',
      unless: 'flag:opened:Interact_Service_Door',
      delay: 10,
      text: {
        en: 'The service door is at the back, behind the ladder.',
        pl: 'Drzwi służbowe są z tyłu, za drabiną.',
      },
    },
    {
      id: 'panel-key',
      when: 'flag:panel-open',
      unless: 'picked:Pickup_Kitchen_Key',
      delay: 4,
      text: { en: 'A key lies in the panel.', pl: 'W panelu leży klucz.' },
    },
    {
      id: 'panel-digits',
      when: ['clue:library-digit-a', 'clue:library-digit-b', 'clue:library-digit-c', 'clue:library-digit-d'],
      unless: 'flag:panel-open',
      delay: 20,
      text: {
        en: 'Four digits. Something is hidden behind the books.',
        pl: 'Cztery cyfry. Coś jest ukryte za książkami.',
      },
    },
    {
      id: 'handprints',
      when: 'clue:handprints',
      unless: 'flag:panel-open',
      delay: 60,
      text: {
        en: 'Handprints on four books. Each has a digit inside.',
        pl: 'Odciski dłoni na czterech książkach. W każdym jest cyfra.',
      },
    },
    {
      id: 'ledger',
      when: 'uv:held',
      unless: ['note:ledger', 'flag:panel-open'],
      delay: 90,
      text: {
        en: 'The ledger on the desk may say how to read what you find.',
        pl: 'Rejestr na biurku może podpowiedzieć, jak czytać to, co znajdziesz.',
      },
    },
    {
      id: 'uv-sweep',
      when: ['uv:held', 'uv:on'],
      unless: 'clue:handprints',
      delay: 25,
      text: {
        en: 'Sweep the beam slowly across the shelves and the fireplace.',
        pl: 'Przesuwaj wiązkę powoli po półkach i kominku.',
      },
    },
    {
      id: 'uv-switch',
      when: 'uv:held',
      unless: ['uv:on', 'clue:handprints'],
      delay: 3,
      text: {
        en: 'Press **Q** to switch to UV, then sweep the room.',
        pl: 'Naciśnij **Q**, aby włączyć UV, i obejrzyj pokój.',
      },
      touchText: {
        en: 'Tap the UV button, then sweep the room.',
        pl: 'Dotknij przycisku UV i obejrzyj pokój.',
      },
    },
    {
      id: 'shoot-now',
      when: 'ghost:mimic:freeze',
      unless: ['camera:raised', 'flag:mimic-caught'],
      delay: 1,
      text: { en: 'It froze. Press **P** to raise the camera.', pl: 'Znieruchomiało. Naciśnij **P**, aby podnieść aparat.' },
      touchText: {
        en: 'It froze. Tap the camera button.',
        pl: 'Znieruchomiało. Dotknij przycisku aparatu.',
      },
    },
    {
      id: 'freeze-mimic',
      when: 'camera:raised',
      unless: ['ghost:mimic:freeze', 'flag:mimic-caught'],
      delay: 6,
      text: {
        en: 'Catch it in your light first, then shoot.',
        pl: 'Najpierw złap go w światło, potem rób zdjęcie.',
      },
    },
    {
      id: 'odd-book',
      unless: 'flag:mimic-caught',
      delay: 20,
      text: {
        en: 'Something is wrong with one of the books.',
        pl: 'Coś jest nie tak z jedną z książek.',
      },
    },
  ],

  debugSkips: [
    { label: 'mimic caught', give: ['flag:mimic-caught'], take: 'Pickup_UV_Lamp' },
    {
      label: 'UV clues',
      give: [
        'clue:read-top-down',
        'clue:hall-message',
        'clue:handprints',
        'clue:library-digit-a',
        'clue:library-digit-b',
        'clue:library-digit-c',
        'clue:library-digit-d',
      ],
    },
    { label: 'panel exposed', give: ['flag:moved:Prop_PanelBook_2', 'flag:moved:Prop_PanelBook_3'] },
    {
      label: 'panel open',
      unlock: 'Interact_Hidden_Panel',
      use: 'Interact_Hidden_Panel',
      give: ['flag:panel-unlocked', 'flag:panel-open'],
    },
    { label: 'kitchen key', take: 'Pickup_Kitchen_Key' },
  ],

  exit: { node: 'Interact_Service_Door', requires: 'item:kitchen-key' },
  complete: {
    eyebrow: { en: '3.17 · the library', pl: '3.17 · biblioteka' },
    title: { en: 'Room complete', pl: 'Pokój ukończony' },
    line: {
      en: 'The service door gives. Cold air, and the smell of old iron.',
      pl: 'Drzwi służbowe ustępują. Zimne powietrze i zapach starego żelaza.',
    },
    next: { en: 'The Kitchen', pl: 'Kuchnia' },
    stars: true,
  },
  secrets: { total: 1, found: ['flag:diary-found'] },
  leads: [
    { when: 'clue:hall-message', text: { en: 'A lead in the hall.', pl: 'Trop w holu.' } },
  ],
} satisfies RoomDef
