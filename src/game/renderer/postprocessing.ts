import * as THREE from 'three/webgpu'
import {
  float,
  fract,
  luminance,
  mix,
  pass,
  rand,
  renderOutput,
  screenUV,
  smoothstep,
  time,
  uniform,
  vec3,
  vec4,
} from 'three/tsl'
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js'
import { tuning } from '../tuning'
import { quality } from './quality'
import { indigoShadows, inkColor, inkEdge, nightLift, paperGrain, syncUkiyo, toneBands } from './ukiyo'

// Which effects are in the chain. The debug panel flips these at runtime; the
// pipeline notices on its next frame and rebuilds its output node once, so
// nothing has to be called after a change. Strengths live in `tuning`.
export const postSettings = {
  bloom: true,
  vignette: true,
  grain: quality.grain,
  grade: true,
  night: true,
  indigo: true,
  bands: true,
  ink: true,
  paper: true,
}

export type PostSettings = typeof postSettings

// BloomNode blurs at half the screen by default; the preset scales that.
const BLOOM_BASE_SCALE = 0.5

// Display-space tints for the grade.
const PLUM = vec3(0.05, 0.012, 0.06)
const WARM = vec3(1.07, 1.0, 0.88)

function signature() {
  const s = postSettings
  return `${s.bloom}|${s.vignette}|${s.grain}|${s.grade}|${s.night}|${s.indigo}|${s.bands}|${s.ink}|${s.paper}`
}

export interface PostPipeline {
  render(): void
  dispose(): void
}

// Scene pass -> bloom -> tone mapping -> grade -> vignette -> grain.
// Bloom works on scene-linear HDR; everything after `renderOutput` works on
// the display-space image, so the look does not shift with exposure.
export function createPostPipeline(
  renderer: THREE.WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): PostPipeline {
  // Resizes itself to the drawing buffer every frame and reads the camera's
  // projection live, so resize, DPR and FOV changes need no handling here.
  const scenePass = pass(scene, camera)
  const sceneColor = scenePass.getTextureNode('output')
  const sceneDepth = scenePass.getTextureNode('depth')
  const edge = inkEdge(sceneDepth)

  const bloomNode = bloom(sceneColor, tuning.bloomStrength, tuning.bloomRadius, tuning.bloomThreshold)
  bloomNode.setResolutionScale(BLOOM_BASE_SCALE * quality.bloomScale)

  const vignetteStrength = uniform(tuning.vignetteStrength)
  const vignetteStart = uniform(tuning.vignetteStart)
  const grainStrength = uniform(tuning.grainStrength)
  const gradeStrength = uniform(tuning.gradeStrength)

  const pipeline = new THREE.RenderPipeline(renderer)
  // We place tone mapping ourselves so vignette and grain come after it.
  pipeline.outputColorTransform = false

  function buildOutput() {
    const hdr = postSettings.bloom ? sceneColor.add(bloomNode) : sceneColor
    // Tone mapping and colour space come from the pipeline's context.
    const display = renderOutput(hdr)
    let rgb = display.rgb

    if (postSettings.grade) {
      const lum = luminance(rgb).clamp(0, 1)
      const shadow = lum.oneMinus().pow(3)
      const graded = rgb
        .mul(mix(vec3(1, 1, 1), WARM, smoothstep(0.25, 0.9, lum)))
        .add(PLUM.mul(shadow))
      rgb = mix(rgb, graded, gradeStrength)
    }

    // The print look sits between the grade and the vignette: flat tones,
    // indigo shadows, then ink over the top, all on the display image.
    if (postSettings.night) rgb = nightLift(rgb)
    if (postSettings.bands) rgb = toneBands(rgb)
    if (postSettings.indigo) rgb = indigoShadows(rgb)
    if (postSettings.ink) rgb = mix(rgb, inkColor, edge)
    if (postSettings.paper) rgb = paperGrain(rgb)

    if (postSettings.vignette) {
      const d = screenUV.sub(0.5).length()
      const v = smoothstep(vignetteStart, float(0.8), d)
      rgb = rgb.mul(v.mul(vignetteStrength).oneMinus())
    }

    if (postSettings.grain) {
      const noise = rand(fract(screenUV.add(fract(time)))).sub(0.5)
      rgb = rgb.add(noise.mul(grainStrength))
    }

    return vec4(rgb, display.a)
  }

  let built = ''

  return {
    render() {
      const sig = signature()
      if (sig !== built) {
        built = sig
        pipeline.outputNode = buildOutput()
        pipeline.needsUpdate = true
      }
      bloomNode.strength.value = tuning.bloomStrength
      bloomNode.radius.value = tuning.bloomRadius
      bloomNode.threshold.value = tuning.bloomThreshold
      vignetteStrength.value = tuning.vignetteStrength
      vignetteStart.value = tuning.vignetteStart
      grainStrength.value = tuning.grainStrength
      gradeStrength.value = tuning.gradeStrength
      syncUkiyo(renderer.getPixelRatio())
      pipeline.render()
    },
    dispose() {
      pipeline.dispose()
      scenePass.dispose()
      bloomNode.dispose()
    },
  }
}
