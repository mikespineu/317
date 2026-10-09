// Every balance number in one place. The object is mutable on purpose: the
// debug panel writes to it live, and systems read it each frame.
export const tuning = {
  // battery
  whiteDrainSeconds: 90,
  uvDrainSeconds: 45,
  startCharge: 0.5,
  levelFull: 0.66,
  levelMedium: 0.33,
  modeSwitchDelay: 0.25,
  swapSeconds: 1.2,
  emergencyPackSeconds: 10,

  // player
  eyeHeight: 1.6,
  playerRadius: 0.25,
  walkSpeed: 1.6,
  mouseSensitivity: 0.0022,
  touchLookSensitivity: 0.005,
  pitchLimitDeg: 80,
  joystickRadiusPx: 60,
  joystickDeadzone: 0.12, // fraction of the radius that reads as no movement
  tapMaxMovePx: 12, // a touch that moves less than this and ends within tapMaxMs is a tap
  tapMaxMs: 250,
  maxFrameDt: 0.05, // s; longer frames (tab switch) are clamped so the player doesn't jump
  cameraRaiseToggle: true, // right mouse: false = hold to raise, true = click to toggle

  // interaction
  reach: 2.0,
  pickupAimRadius: 0.16, // m; a pickup this close to the aim line is picked without an exact hit
  drawerSeconds: 0.5,
  doorSeconds: 1.2,
  completeDelay: 0.5, // s between the door stopping and the "Level complete" card
  padlockDropSeconds: 0.45,
  padlockDrop: 0.45, // m the opened padlock falls before it is hidden
  highlightLift: 0.1, // emissive added to the focused object
  messageSeconds: 2.6, // how long a HUD message stays
  wheelStepPx: 30, // vertical drag per padlock wheel step

  // beams
  whiteAngleDeg: 22,
  whiteDistFull: 9,
  whiteDistLow: 4,
  uvAngleDeg: 16,
  uvDist: 4,
  clueHoldSeconds: 1,

  // light
  whiteIntensity: 45, // candela at full strength
  uvIntensity: 5, // UV lights the room only weakly
  lightPenumbra: 0.25, // the cookie texture does most of the shaping
  lightDecay: 1.6,
  // Lens position in camera space: right hand, so shadows read, and inside
  // playerRadius so it never ends up behind a wall.
  lightOffsetX: 0.1,
  lightOffsetY: -0.085,
  lightOffsetZ: -0.22,
  lightConvergeDist: 5, // the beam crosses the view centre this far ahead
  shadowBias: -0.0008,
  shadowNormalBias: 0.02,
  // The held model is drawn at half size and half distance: same on screen,
  // but it stays out of the walls and clear of the 0.05 near plane.
  heldScale: 0.5,
  heldX: 0.1,
  heldY: -0.085,
  heldZ: -0.13,
  heldBob: 0.002, // metres of idle sway on the held flashlight
  lowStrength: 0.35, // beam strength just before the pack dies
  strengthCurve: 1.4, // >1 keeps the beam strong for longer
  flickerDepth: 0.18,
  flickerRate: 13,
  flickerDipChance: 0.6, // dips per second while low
  flickerDipSeconds: 0.09,
  flickerDipStrength: 0.25,
  sputterSeconds: 1.6,
  emptyGlow: 0.08,
  lowTickSeconds: 2.5,
  coneOpacity: 0.16,
  coneLengthFrac: 0.55, // visible cone length as a fraction of the beam range
  coneEdgePower: 1.5,
  coneLengthPower: 1.8,
  dustSize: 0.012, // metres
  dustOpacity: 0.7,
  dustDrift: 0.12, // metres of wander around each mote's home
  dustSpeed: 0.12,
  dustFall: 0.012, // m/s
  revealGlow: 1.6, // emissive boost of the revealed ink, for bloom
  clueMaskThreshold: 0.15,
  uvInkHoldSeconds: 0.6, // the lamp resting on written ink before its clue is logged

  // wisp
  wispFreezeDelay: 0.4,
  wispFreezeSeconds: 3,
  wispFleeSeconds: 1.5,
  wispDissolveSeconds: 1,
  wispWanderSpeed: 0.35, // rate of travel along the noise path
  wispFleeSpeed: 2.4, // m/s
  wispFleePush: 0.3, // seconds to reach flee speed
  wispFollow: 2.5, // how tightly it tracks its wander target, 1/s
  wispMargin: 0.45, // inner box: metres kept off the walls
  wispMinY: 1.0,
  wispMaxY: 2.1,
  wispBob: 0.06, // metres
  wispTremble: 0.003, // metres the head shivers while frozen; the cloth does the rest
  wispExposureRise: 2.5, // per second while lit
  wispExposureDecay: 0.8, // per second in the dark
  wispGlow: 0.5, // base brightness of the material
  wispExposureGlow: 0.25, // extra brightness at full exposure
  wispLight: 0.35, // point light intensity, 0 = none
  wispWhisperDist: 4.5, // metres at which the whisper fades out
  wispMaxDrift: 0.9, // m/s cap while wandering
  wispRoomHalfX: 2.0, // room interior half-size, until the room def carries bounds
  wispRoomHalfZ: 2.5,
  // mimic
  mimicFreezeDelay: 0.6, // s of white light on the disguised object before it freezes
  mimicRevealSeconds: 3, // true shape shown
  mimicUnlitDrain: 4, // the reveal runs out this much faster while the light is off it
  mimicPopSeconds: 0.25, // disguise out, true shape in
  mimicTwitchMin: 5, // s between twitches
  mimicTwitchMax: 8,
  mimicTwitchSeconds: 0.45,
  mimicTwitchShake: 0.012, // m
  mimicTwitchTilt: 0.052, // rad
  mimicRedisguiseSeconds: 0.4, // gap before it settles on a new spot
  mimicPity: 0.5, // s added to the next reveal after each one that ended without a good photo
  mimicPityMax: 2,
  // ink ghost
  inkSpeed: 0.3, // m/s along its route
  inkSlow: 0.25, // speed factor at full UV exposure
  inkDwell: 1.5, // s paused at each waypoint
  inkCatchExposure: 0.4, // exposure at which a good photo dissolves it
  inkFadeStart: 0.02, // uvMask range over which it fades in
  inkFadeEnd: 0.3,
  inkLight: 0.25, // scale of its point light, times how visible it is
  // wisp: the sheet
  sheetStiffness: 42, // spring pulling the cloth after the head, 1/s²
  sheetDamping: 0.3, // damping ratio; below 1 the cloth swings past and settles
  sheetMaxLag: 0.26, // metres the hem may trail behind the head
  sheetPress: 0.2, // share of that movement the leading side makes, pressed on the body
  sheetArmReach: 1.0, // how far the arms hold the cloth out, as a fraction of the radius
  sheetArmLift: 0.15, // metres the arms raise the cloth
  sheetFoldDepth: 0.24, // depth of the pleats at the hem, as a fraction of the radius
  sheetFlutter: 0.018, // ripple in the hem at rest
  sheetFlutterSpeed: 1.6, // extra ripple per m/s
  sheetFreezeShiver: 0.03, // extra ripple while frozen in the light
  sheetBillow: 2.2, // how much sinking fills the skirt
  sheetTurnRate: 3, // how fast it turns to face the player, 1/s
  sheetOpacity: 0.96,

  // candle
  candleLight: 3, // candela when lit
  candleDistance: 4.5, // m, where its light fades out

  // hints
  uvHintDelay: 20, // s after the flashlight is found before the UV hint appears

  // props (throwable)
  holdDistance: 0.75, // m in front of the eye
  holdRight: 0.22, // m to the right of the view centre
  holdDown: 0.2, // m below the view centre
  holdFollow: 16, // 1/s, how tightly the held prop trails the view
  throwSpeed: 6.5, // m/s
  throwLift: 0.9, // m/s added upward so a level throw arcs
  throwSpin: 9, // rad/s
  propGravity: 9.8,
  propBounce: 0.32, // share of the normal speed kept after a hit
  propFriction: 0.18, // share of the sliding speed lost per hit
  propSlide: 3, // 1/s, how fast a prop slides to a stop on the ground
  propRestSpeed: 0.35, // m/s below which a prop on the ground settles
  propCeiling: 2.8, // m, until the room def carries bounds

  // camera
  photoCooldown: 0.8,
  photoDissolveQuality: 0.5,
  cameraZoom: 1.2,
  aimAssistRadius: 0.08,
  aimAssistStrength: 2.5, // fraction of the angular error closed per second
  cameraRaiseSeconds: 0.22,
  photoWidth: 512, // px
  photoCardSeconds: 6, // the card closes itself after this long
  photoWeightLit: 0.35,
  photoWeightFramed: 0.25,
  photoWeightClose: 0.2,
  photoWeightSharp: 0.2,
  photoFramedRadius: 0.7, // NDC distance from centre that scores 0
  photoCloseFraction: 0.4, // screen height filled that scores 1
  photoSharpSpeed: 1.5, // m/s that scores 0
  ghostHeight: 0.63, // metres, for the on-screen size

  // mirror
  mirrorUpdateEvery: 1, // 2 = refresh the reflection every other frame
  mirrorTint: 0.92, // red/green multiplier, <1 cools the reflection
  mirrorWordGlow: 0.35, // emissive of the reversed word, so it reads unlit
  mirrorWordOpacity: 0.55,

  // atmosphere
  backgroundColor: '#0a0c20',
  moonColor: '#7f9cff',
  moonIntensity: 0.4,
  ambientColor: '#6f7fb8',
  ambientIntensity: 0.12,
  fogColor: '#131a38',
  fogDensity: 0.05,
  moonPatchOpacity: 0.18, // additive glow of the window's shape on the floor

  // post
  bloomStrength: 0.55,
  bloomRadius: 0.55,
  bloomThreshold: 1.0, // scene-linear luminance, before tone mapping
  vignetteStrength: 0.5,
  vignetteStart: 0.3, // distance from screen centre where darkening begins
  grainStrength: 0.035,
  gradeStrength: 0.6, // 0 = untouched, 1 = full plum shadows / warm highlights
  inkWidth: 1.4, // outline thickness, CSS px
  inkThreshold: 0.012, // depth-curvature that starts a line; lower = more lines
  inkStrength: 0.95, // 1 = lines fully ink-black
  inkWobble: 1.1, // CSS px the line wanders off the true edge; 0 = ruled
  inkPressure: 0.45, // how much the line swells and thins along its length
  inkCrease: 0.65, // weight of creases inside a shape against its outline
  inkNear: 0.5, // extra weight on lines close to the eye, less on far ones
  nightGamma: 0.6, // brightness curve before banding; 1 = off, lower = brighter shadows
  bandCount: 6, // flat tones the brightness is snapped to
  bandStrength: 0.7, // 0 = smooth shading, 1 = fully banded
  indigoLift: 0.85, // how far blacks are lifted to indigo
  paperStrength: 0.14, // paper fibre darkening

  // audio
  masterVolume: 0.6,
  roomToneVolume: 0.5,
  uvHumVolume: 0.35,
  whisperVolume: 0.6,
  creakMinSeconds: 18, // gap between the room's idle creaks
  creakMaxSeconds: 45,
  clockTickVolume: 0.5,
  windVolume: 0.4,
  keyWhisperBoost: 1.5, // the key Wisp's whisper against the others

  // intro
  introSlamSeconds: 0.22, // doors swing shut, ease-in
  introShakeSeconds: 0.15, // camera shake after the slam
  introShakeAmount: 0.012, // radians
  introLockSeconds: 2.6, // input lock, whole intro
  introDipSeconds: 0.3, // dip to near-black before control returns
  introLookDeg: 4, // how far the view eases toward the clock, at most

  // ghosts
  ghostZoneMargin: 0.2, // m; the wander path stays this far inside each zone
  keyDropGravity: 4, // m/s², the dropped key's fall
  keyDropRest: 0.02, // m above the floor
  keyDropBounce: 0.25, // share of the fall speed kept by the one bounce
  keyGlint: 0.8, // emissive pulse of a dropped item until it is picked up

  // interactions (hall)
  searchSeconds: 0.8, // coat pocket rummage
  lidSeconds: 0.9, // chest lid, ease-out
  symbolLockDropSeconds: 0.5,
  ladderSeconds: 1.1, // the library ladder rolling aside

  // mirror clue
  mirrorClueDwell: 1.0, // s the text must stay lit and in the reflection
  mirrorClueMinLight: 0.35, // beam strength on the text
  mirrorTextGlow: 0, // emissive of the mirror-only text; raise only if playtests need it
}

export type Tuning = typeof tuning
