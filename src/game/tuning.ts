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

  // wisp
  wispFreezeDelay: 0.4,
  wispFreezeSeconds: 3,
  wispFleeSeconds: 1.5,
  wispDissolveSeconds: 1,
  wispWanderSpeed: 0.35, // rate of travel along the noise path
  wispFleeSpeed: 2.4, // m/s
  wispFollow: 2.5, // how tightly it tracks its wander target, 1/s
  wispMargin: 0.45, // inner box: metres kept off the walls
  wispMinY: 1.0,
  wispMaxY: 2.1,
  wispBob: 0.06, // metres
  wispTremble: 0.012, // metres, while frozen
  wispExposureRise: 2.5, // per second while lit
  wispExposureDecay: 0.8, // per second in the dark
  wispGlow: 1.0, // base brightness of the material
  wispExposureGlow: 1.4, // extra brightness at full exposure
  wispLight: 0.35, // point light intensity, 0 = none
  wispWhisperDist: 4.5, // metres at which the whisper fades out
  wispMaxDrift: 0.9, // m/s cap while wandering
  wispRoomHalfX: 2.0, // room interior half-size, until the room def carries bounds
  wispRoomHalfZ: 2.5,

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
  ghostHeight: 0.5, // metres, for the on-screen size

  // mirror
  mirrorUpdateEvery: 1, // 2 = refresh the reflection every other frame
  mirrorTint: 0.92, // red/green multiplier, <1 cools the reflection
  mirrorWordGlow: 0.35, // emissive of the reversed word, so it reads unlit
  mirrorWordOpacity: 0.55,

  // atmosphere
  backgroundColor: '#05050a',
  moonColor: '#7f9cff',
  moonIntensity: 0.22,
  ambientColor: '#6f7fb8',
  ambientIntensity: 0.04,
  fogColor: '#0a0d18',
  fogDensity: 0.05,
  moonPatchOpacity: 0.1, // additive glow of the window's shape on the floor

  // post
  bloomStrength: 0.55,
  bloomRadius: 0.55,
  bloomThreshold: 1.0, // scene-linear luminance, before tone mapping
  vignetteStrength: 0.5,
  vignetteStart: 0.3, // distance from screen centre where darkening begins
  grainStrength: 0.035,
  gradeStrength: 0.6, // 0 = untouched, 1 = full plum shadows / warm highlights

  // audio
  masterVolume: 0.6,
  roomToneVolume: 0.5,
  uvHumVolume: 0.35,
  whisperVolume: 0.6,
  creakMinSeconds: 18, // gap between the room's idle creaks
  creakMaxSeconds: 45,
}

export type Tuning = typeof tuning
