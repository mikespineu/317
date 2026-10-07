// Copies the Blender exports into public/ so the game never loads from blender/.
// Compression (gltf-transform: meshopt + KTX2) will be added here later.
import { cp, mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const from = 'blender/export'
const to = 'public/models/level0'

await mkdir(to, { recursive: true })
const files = (await readdir(from)).filter((f) => f.endsWith('.glb'))
await Promise.all(files.map((f) => cp(join(from, f), join(to, f))))
console.log(`assets: copied ${files.length} .glb files to ${to}`)
