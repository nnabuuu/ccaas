import { createContext, useContext, useMemo, createElement, Fragment, type ReactNode } from 'react'
import { en } from './en'
import { zh } from './zh'

export type Locale = 'en' | 'zh'
export type Dict = typeof en
type DictMap = Record<Locale, Record<keyof Dict, string>>

const dicts: DictMap = { en, zh }

export function createT(locale: Locale) {
  const dict = dicts[locale] ?? dicts.en
  const fb = dicts.en
  return function t(key: keyof Dict, params?: Record<string, string | number>): string {
    let s: string = dict[key] ?? fb[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.replaceAll(`{${k}}`, String(v))
      }
    }
    return s
  }
}

export type TFn = ReturnType<typeof createT>

export const LocaleCtx = createContext<{ locale: Locale; t: TFn }>({
  locale: 'en',
  t: createT('en'),
})

export function useLocale() {
  return useContext(LocaleCtx)
}

export function useT(localeOverride?: Locale): TFn {
  const ctx = useContext(LocaleCtx)
  const effective = localeOverride ?? ctx.locale
  return useMemo(() => createT(effective), [effective])
}

export function LocaleScope({ locale, children }: { locale?: Locale; children: ReactNode }) {
  const parent = useLocale()
  const effective = locale ?? parent.locale
  const value = useMemo(() => ({ locale: effective, t: createT(effective) }), [effective])
  if (effective === parent.locale) return createElement(Fragment, null, children)
  return createElement(LocaleCtx.Provider, { value }, children)
}
