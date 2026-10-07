import { useGame } from '../store'

// Conditions as data. The room definition speaks in tokens ('item:key',
// 'flag:drawer-open', 'clue:drawer-code'); this is the only place that maps
// them onto the store, so the same evaluator can later run room JSON.
// Store keys carry no prefix.
export type Token = string
type Tokens = Token | readonly Token[] | undefined

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
    default:
      if (import.meta.env.DEV) console.warn(`[chain] unknown token "${token}"`)
      return false
  }
}

// True when every token holds; no tokens means no requirement.
export function check(tokens: Tokens): boolean {
  return list(tokens).every(checkOne)
}

// Grants `sets` / `gives`: flags are set, items and clues are added.
export function apply(tokens: Tokens) {
  for (const token of list(tokens)) {
    const { kind, id } = parse(token)
    const s = useGame.getState()
    if (kind === 'item') s.addItem(id)
    else if (kind === 'flag') s.setFlag(id)
    else if (kind === 'clue') s.addClue(id)
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
