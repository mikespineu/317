import { useMemo } from 'react'
import { useRouteContext } from '@tanstack/react-router'
import { create } from 'zustand'
import { en } from './en'
import type { Key } from './en'
import { pl } from './pl'

export type { Key }

// To add a language: list it here, write its dictionary, and fill the
// Localized texts in the room definitions (tsc names every one that is missing).
export const LANGS = ['en', 'pl'] as const
export type Lang = (typeof LANGS)[number]
export const DEFAULT_LANG: Lang = 'en'
export const LANG_NAMES: Readonly<Record<Lang, string>> = { en: 'English', pl: 'Polski' }
export const LANG_COOKIE = 'lang'

// Text that lives in data (the room definitions) rather than in a dictionary.
export type Localized = Readonly<Record<Lang, string>>

const dictionaries: Readonly<Record<Lang, Readonly<Record<string, string>>>> = { en, pl }

export function asLang(value: string | null | undefined): Lang | null {
  const tag = value?.trim().toLowerCase().split('-')[0]
  return LANGS.find((l) => l === tag) ?? null
}

// The first supported language of a list in order of preference, e.g.
// navigator.languages.
export function preferredLang(tags: readonly string[]): Lang {
  for (const tag of tags) {
    const lang = asLang(tag)
    if (lang) return lang
  }
  return DEFAULT_LANG
}

// The server renders <html lang> from the cookie or Accept-Language (see
// detect.ts), and the client starts from that so hydration matches.
function initialLang(): Lang {
  if (typeof document === 'undefined') return DEFAULT_LANG
  return asLang(document.documentElement.lang) ?? preferredLang(navigator.languages ?? [])
}

const useLangStore = create<{ lang: Lang }>(() => ({ lang: initialLang() }))

// The language in the browser. On the server there is one store for every
// request, so server-rendered components must use useLang() / useT() instead.
export const currentLang = () => useLangStore.getState().lang

// The player's choice, kept in a cookie so the server renders it next time.
export function setLang(lang: Lang) {
  useLangStore.setState({ lang })
  document.documentElement.lang = lang
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`
}

export type Params = Readonly<Record<string, string | number>>
export type Translate = (key: Key, params?: Params) => string

function translate(lang: Lang, key: string, params?: Params): string | undefined {
  const text = dictionaries[lang][key] ?? dictionaries[DEFAULT_LANG][key]
  if (text === undefined || !params) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  )
}

export function useLang(): Lang {
  const stored = useLangStore((s) => s.lang)
  const requested = useRouteContext({ from: '__root__', select: (c) => c.lang })
  return typeof window === 'undefined' ? requested : stored
}

// For components: re-renders when the language changes, and is right on the server.
export function useT(): Translate {
  const lang = useLang()
  return useMemo(() => (key, params) => translate(lang, key, params) ?? key, [lang])
}

// For code outside React (actions, the guide). Browser only.
export const t: Translate = (key, params) => translate(currentLang(), key, params) ?? key

// A key built at run time ('item.' + id): undefined when no dictionary has it.
export const lookup = (key: string, params?: Params) => translate(currentLang(), key, params)

// Picks the current language out of a definition's text. Browser only.
export const tr = (text: Localized) => text[currentLang()]
