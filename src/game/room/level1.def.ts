import type { RoomDef } from './roomDef'

// Room 1, the Entrance Hall. North (Blender +Y) is three.js -Z: a yaw of 0
// looks at the stairs and the clock. See docs/level-1-implementation.md.
export const level1 = {
  id: 'entrance-hall',
  title: 'The Entrance Hall',
  scene: '/models/level1/level-1.glb',
  spawn: 'Spawn_Player',
  spawnYawDeg: 0,
  lights: { uv: false }, // the UV lamp is found in Room 2
  startCharge: 0.5,
  parSeconds: 480,

  intro: {
    doors: ['Front_Door_L', 'Front_Door_R'],
    look: 'Spawn_Intro_Look',
    slamAfter: 1.4,
  },

  atmosphere: {
    window: { x: -1.9, y: 1.8, z: 4.0, w: 0.84, h: 2.24, facing: 'south' },
    moon: [-3.5, 6.0, 9.0], // behind the south window, shining in toward the hall
    fogScale: 0.7,
    roomTone: 'hall',
  },

  interactables: [
    { node: 'Front_Door_L', type: 'locked', line: "It won't budge. Something is holding it shut." },
    { node: 'Front_Door_R', type: 'locked', line: "It won't budge. Something is holding it shut." },
    { node: 'Boarded_Door', type: 'locked', line: 'Boarded up from this side. Not yet.' },
    {
      node: 'Interact_Writing_Desk_Drawer',
      type: 'drawer',
      slide: 0.32,
      slideDir: [1, 0, 0],
      requires: 'item:brass-key',
      lockedLine: 'Locked. A small brass keyhole.',
      sets: 'flag:desk-open',
    },
    {
      node: 'Interact_Coat_Pocket',
      type: 'search',
      gives: ['item:battery'],
      sets: 'flag:coat-searched',
      line: 'A battery pack, in the coat pocket.',
    },
    // The candelabra on the console table: three candles, lit together.
    {
      node: 'Prop_Candelabra',
      type: 'candle',
      flames: [
        [0, 0.455, 0.13],
        [0, 0.475, 0],
        [0, 0.455, -0.13],
      ],
    },
    { node: 'Portrait_1_Plaque', type: 'inspect', line: 'A brass plaque: 1874.' },
    { node: 'Portrait_2_Plaque', type: 'inspect', line: 'A brass plaque: 1869.' },
    { node: 'Portrait_3_Plaque', type: 'inspect', line: 'A brass plaque: 1877.' },
    {
      node: 'Interact_Chest_Lid',
      type: 'lid',
      hingeAxis: 'x',
      openAngleDeg: -100,
      lock: {
        type: 'symbol',
        code: ['moon', 'bat', 'pumpkin'],
        wheels: ['moon', 'bat', 'pumpkin', 'key', 'eye'],
        mesh: 'Chest_SymbolLock',
        sets: 'flag:chest-unlocked',
      },
      sets: 'flag:chest-open',
    },
    // Hinged at the south end with the leaf along -Z: positive swings it east, into the vestibule.
    { node: 'Interact_Library_Door', type: 'door', requires: 'item:library-key', openAngleDeg: 95 },
    // Return visit (Room 2 gives the UV lamp). Present now so names never change.
    {
      node: 'Interact_Clock_Glass',
      type: 'uv-reveal',
      gives: ['clue:clock-time'],
      enabled: false,
      line: 'A note behind the glass, smeared past reading.',
    },
  ],

  pickups: [
    {
      node: 'Pickup_Flashlight',
      item: 'flashlight',
      model: '/models/shared/flashlight.glb',
      at: [0.4, 0.042, 2.9],
      yawDeg: 20,
      glow: true,
    },
    { node: 'Pickup_Brass_Key', item: 'brass-key', visibleWhen: 'flag:brass-key-dropped' },
    { node: 'Pickup_Letter', item: 'letter', visibleWhen: 'flag:desk-open', note: 'letter' },
    { node: 'Pickup_Library_Key', item: 'library-key', visibleWhen: 'flag:chest-open' },
    { node: 'Pickup_Battery_Console', item: 'battery' },
    { node: 'Pickup_Battery_Coat', item: 'battery', hidden: true }, // given by the search, never shown
  ],

  props: [],

  ghosts: [
    {
      id: 'wisp-key',
      type: 'wisp',
      mesh: 'Wisp_Key',
      spawn: 'Spawn_Wisp_Key',
      baseScore: 100,
      key: true,
      whisper: 'wispWhisperKey',
      drops: { pickup: 'Pickup_Brass_Key', sets: 'flag:brass-key-dropped' },
      zone: { min: [-1.8, 1.0, -2.2], max: [1.8, 2.0, 2.4] }, // open floor, below the chandelier
    },
    {
      id: 'wisp-gallery',
      type: 'wisp',
      mesh: 'Wisp_Gallery',
      spawn: 'Spawn_Wisp_Gallery',
      baseScore: 150,
      zone: { min: [-2.8, 2.7, -3.9], max: [-1.7, 3.4, -2.9] }, // above the landing
    },
    // { id: 'ink-1', type: 'ink', spawn: 'Spawn_InkGhost', secret: true, enabled: false },
  ],

  mirror: { node: 'Mirror_Surface', clue: { node: 'MirrorOnly_Text', gives: 'clue:eldest-first' } },

  notes: {
    letter: {
      title: 'A letter, unsigned',
      body: [
        'Whoever moved the portraits, put them back.',
        'The order is not yours to choose.',
        'This house only tells the truth to the glass.',
      ],
      gives: 'clue:letter',
    },
  },

  emergencyPack: { pickup: 'Pickup_Battery_Console', spawn: 'Spawn_Battery_Emergency' },

  // One nudge per link of the chain (Step 12 of the plan). A step that
  // replaces another on the same condition sits above it.
  guide: [
    {
      id: 'find-light',
      unless: 'light:held',
      delay: 0,
      text: 'Too dark to see. Find the flashlight on the floor and press **E** to pick it up.',
      touchText: 'Too dark to see. Find the flashlight on the floor and tap it.',
    },
    {
      id: 'freeze-first',
      when: ['light:held', 'camera:raised'],
      unless: ['ghost:wisp-key:freeze', 'flag:brass-key-dropped'],
      delay: 6,
      text: 'Catch it in your light first, then shoot.',
    },
    {
      id: 'raise-camera',
      when: 'light:held',
      unless: ['camera:raised', 'flag:brass-key-dropped'],
      delay: 25,
      text: 'Something is whispering. Press **P** to raise the camera.',
      touchText: 'Something is whispering. Tap the camera button to raise the camera.',
    },
    {
      id: 'key-dropped',
      when: 'flag:brass-key-dropped',
      unless: 'picked:Pickup_Brass_Key',
      delay: 5,
      text: 'It dropped something.',
    },
    {
      id: 'brass-key',
      when: 'item:brass-key',
      unless: 'flag:desk-open',
      delay: 30,
      text: 'A small brass key. Which lock is small enough?',
    },
    {
      id: 'mirror-light',
      when: 'clue:letter',
      unless: ['clue:eldest-first', 'flag:chest-unlocked'],
      delay: 120,
      text: 'Shine your light behind you while you look into the mirror.',
    },
    {
      id: 'mirror-look',
      when: 'clue:letter',
      unless: ['clue:eldest-first', 'flag:chest-unlocked'],
      delay: 60,
      text: '*…tells the truth to the glass.* Look into the mirror.',
    },
    {
      id: 'eldest-first',
      when: 'clue:eldest-first',
      unless: 'flag:chest-unlocked',
      delay: 30,
      text: 'Eldest first. Each portrait has a year and a symbol. The chest by the stairs has three wheels.',
    },
    {
      id: 'chest-key',
      when: 'flag:chest-open',
      unless: 'picked:Pickup_Library_Key',
      delay: 4,
      text: 'A key lies at the bottom of the chest.',
    },
    {
      id: 'library-door',
      when: 'item:library-key',
      unless: 'flag:opened:Interact_Library_Door',
      delay: 10,
      text: 'The Library door is by the clock.',
    },
  ],
  debugSkips: [
    { label: 'flashlight', take: 'Pickup_Flashlight' },
    { label: 'brass key', give: ['flag:brass-key-dropped'], take: 'Pickup_Brass_Key' },
    { label: 'desk open', use: 'Interact_Writing_Desk_Drawer', give: ['flag:desk-open'] },
    // The letter comes along, as the link before the mirror.
    { label: 'mirror clue', give: ['clue:letter', 'clue:eldest-first'], take: 'Pickup_Letter' },
    {
      label: 'chest open',
      unlock: 'Interact_Chest_Lid',
      use: 'Interact_Chest_Lid',
      give: ['flag:chest-unlocked', 'flag:chest-open'],
    },
    { label: 'library key', take: 'Pickup_Library_Key' },
  ],
  exit: { node: 'Interact_Library_Door', requires: 'item:library-key' },
  complete: {
    eyebrow: '3.17 · the entrance hall',
    title: 'Room complete',
    line: 'The Library door gives. Paper and dust.',
    next: 'The Library',
    stars: true,
  },
  secrets: { total: 2, note: 'Something here needs a light you do not have yet.' }, // the clock note and the Ink Ghost, both after Room 2
} satisfies RoomDef
