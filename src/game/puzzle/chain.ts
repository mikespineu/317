import { runtime } from '../runtime'
import { useGame } from '../store'

// Conditions as data. The room definition speaks in tokens ('item:key',
// 'flag:drawer-open', 'clue:drawer-code'); this is the only place that maps
// them onto the store, so the same evaluator can later run room JSON.
// Store keys carry no prefix.
//
// 'item:', 'flag:' and 'clue:' can be checked and granted. The rest are
// read-only conditions for the guide: 'light:held', 'uv:held', 'uv:on', 'camera:raised',
// 'photo:<ghost id>', 'picked:<Pickup_ node>', 'note:<id>' (read),
// 'ghost:<id>:<state>' (the live state, e.g. 'ghost:wisp-key:freeze').
export type Token = string
type Tokens = Token | readonly Token[] | undefined

const READ_ONLY = new Set(['light', 'uv', 'camera', 'photo', 'picked', 'note', 'ghost'])

function parse(token: Token) {
  const i = token.indexOf(':')
  return { kind: token.slice(0, i), id: token.slice(i + 1) }
}

function list(tokens: Tokens): readonly Token[] {
  if (!tokens) return []
  return typeof tokens === 'string' ? [tokens] : tokens
}

function checkOne(token: Token): boolean {
  const { kind, id } = parse(token)
  const s = useGame.getState()
  switch (kind) {
    case 'item':
      return id === 'battery' ? s.spares > 0 : (s.items[id] ?? 0) > 0
    case 'flag':
      return s.flags[id] === true
    case 'clue':
      return s.clues.includes(id)
    case 'light':
      return s.hasLight
    case 'uv':
      return id === 'held' ? s.hasUv : s.lightOn && s.lightMode === 'uv'
    case 'camera':
      return s.cameraRaised
    case 'photo':
      return s.photos.some((p) => p.ghostId === id)
    case 'picked':
      return s.pickedUp[id] === true
    case 'note':
      return s.notesRead.includes(id)
    case 'ghost': {
      // Ghost ids have no colon, so the state is whatever follows the last one.
      const cut = id.lastIndexOf(':')
      return runtime.ghosts.get(id.slice(0, cut))?.state === id.slice(cut + 1)
    }
    default:
      if (import.meta.env.DEV) console.warn(`[chain] unknown token "${token}"`)
      return false
  }
}

// True when every token holds; no tokens means no requirement.
export function check(tokens: Tokens): boolean {
  return list(tokens).every(checkOne)
}

// True when at least one token holds (a guide step's `unless`).
export function checkAny(tokens: Tokens): boolean {
  return list(tokens).some(checkOne)
}

// Grants `sets` / `gives`: flags are set, items and clues are added.
export function apply(tokens: Tokens) {
  for (const token of list(tokens)) {
    const { kind, id } = parse(token)
    const s = useGame.getState()
    if (kind === 'item') s.addItem(id)
    else if (kind === 'flag') s.setFlag(id)
    else if (kind === 'clue') s.addClue(id)
    else if (READ_ONLY.has(kind)) continue
    else if (import.meta.env.DEV) console.warn(`[chain] unknown token "${token}"`)
  }
}

// Spends the item tokens of a requirement (a key used on its door).
export function consume(tokens: Tokens) {
  for (const token of list(tokens)) {
    const { kind, id } = parse(token)
    if (kind === 'item') useGame.getState().removeItem(id)
  }
}
