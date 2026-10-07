import { RenderTarget, SRGBColorSpace, UnsignedByteType } from 'three/webgpu'
import type { Camera, Scene, WebGPURenderer } from 'three/webgpu'
import { useGame } from '../store'
import { tuning } from '../tuning'

export interface CaptureSource {
  renderer: WebGPURenderer
  scene: Scene
  camera: Camera
}

// True when a coarse grid of samples is all (near) black: the backend handed
// back an empty canvas. A genuinely pitch-black frame also lands here, which
// only costs one extra render.
function isBlank(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const { data } = ctx.getImageData(0, 0, width, height)
  const stepX = Math.max(1, Math.floor(width / 24))
  const stepY = Math.max(1, Math.floor(height / 16))
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const i = (y * width + x) * 4
      if (data[i] > 2 || data[i + 1] > 2 || data[i + 2] > 2) return false
    }
  }
  return true
}

// Fallback: render the view once into an sRGB target and read it back. This
// skips the post-processing, so the photo is a little flatter than the screen.
async function renderAndRead(
  { renderer, scene, camera }: CaptureSource,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const target = new RenderTarget(width, height, {
    type: UnsignedByteType,
    colorSpace: SRGBColorSpace,
  })
  try {
    const previous = renderer.getRenderTarget()
    renderer.setRenderTarget(target)
    renderer.render(scene, camera)
    renderer.setRenderTarget(previous)

    const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height)
    // WebGPU pads each row to 256 bytes and starts at the top; WebGL packs
    // rows tightly and starts at the bottom.
    const webgpu = useGame.getState().backend === 'webgpu'
    const stride = webgpu ? Math.ceil((width * 4) / 256) * 256 : width * 4
    const image = ctx.createImageData(width, height)
    for (let y = 0; y < height; y++) {
      const from = (webgpu ? y : height - 1 - y) * stride
      const to = y * width * 4
      for (let x = 0; x < width * 4; x += 4) {
        image.data[to + x] = pixels[from + x] as number
        image.data[to + x + 1] = pixels[from + x + 1] as number
        image.data[to + x + 2] = pixels[from + x + 2] as number
        image.data[to + x + 3] = 255
      }
    }
    ctx.putImageData(image, 0, 0)
  } finally {
    target.dispose()
  }
}

// Call right after the frame was rendered (useFrame priority 2): the copy of
// the renderer's canvas happens synchronously, before the browser presents
// and discards the drawing buffer. Resolves to an object URL of a small JPEG.
export async function capturePhoto(source: CaptureSource): Promise<string> {
  const view = source.renderer.domElement
  const width = Math.max(64, Math.round(tuning.photoWidth))
  const height = Math.max(1, Math.round((width * view.height) / Math.max(1, view.width)))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D canvas is not available')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)

  let copied = false
  try {
    ctx.drawImage(view, 0, 0, width, height)
    copied = !isBlank(ctx, width, height)
  } catch (error) {
    console.warn('[camera] could not copy the canvas', error)
  }
  if (!copied) {
    try {
      await renderAndRead(source, ctx, width, height)
    } catch (error) {
      console.warn('[camera] render target readback failed', error)
    }
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.8),
  )
  if (!blob) throw new Error('could not encode the photo')
  return URL.createObjectURL(blob)
}
