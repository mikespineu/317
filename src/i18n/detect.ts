import { createIsomorphicFn } from '@tanstack/react-start'
import { getCookie, getRequestHeader } from '@tanstack/react-start/server'
import { LANG_COOKIE, asLang, currentLang, preferredLang } from './index'
import type { Lang } from './index'

// 'pl,en-US;q=0.8,en;q=0.6' -> ['pl', 'en-US', 'en'], best first.
function acceptedLanguages(header: string | undefined): string[] {
  return (header ?? '')
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      return { tag, q: q ? Number(q.slice(2)) : 1 }
    })
    .filter((entry) => entry.tag && entry.q > 0)
    .sort((a, b) => b.q - a.q)
    .map((entry) => entry.tag)
}

// The language of this request: the player's saved choice, else the browser's
// preference. In the browser it is whatever the page is already using.
export const detectLang = createIsomorphicFn()
  .server(
    (): Lang =>
      asLang(getCookie(LANG_COOKIE)) ??
      preferredLang(acceptedLanguages(getRequestHeader('accept-language'))),
  )
  .client((): Lang => currentLang())
