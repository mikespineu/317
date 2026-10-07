// Copies the Blender exports into public/ so the game never loads from blender/.
// level-N*.glb goes to models/levelN, everything else (held items) to models/shared.
// Compression (gltf-transform: meshopt + KTX2) will be added here later.
import { cp, mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const from = 'blender/export'
const to = 'public/models'

const folderOf = (file) => {
  const level = /^level-(\d+)/.exec(file)
  return level ? `level${level[1]}` : 'shared'
}

const files = (await readdir(from)).filter((f) => f.endsWith('.glb'))
for (const dir of new Set(files.map(folderOf))) await mkdir(join(to, dir), { recursive: true })
await Promise.all(files.map((f) => cp(join(from, f), join(to, folderOf(f), f))))
console.log(`assets: copied ${files.length} .glb files to ${to}`)
