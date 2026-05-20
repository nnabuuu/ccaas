import { describe, it, expect } from 'vitest'
import { createT, LocaleCtx } from '../index'
import { en } from '../en'
import { zh } from '../zh'

describe('createT() core', () => {
  const tEn = createT('en')
  const tZh = createT('zh')

  it('returns English text for locale "en"', () => {
    expect(tEn('phase.listen')).toBe('Listen')
  })

  it('returns Chinese text for locale "zh"', () => {
    expect(tZh('phase.listen')).toBe('讲解')
  })

  it('interpolates single {param}', () => {
    expect(tEn('phase.lockedMsg', { prev: 'A', next: 'B' })).toBe(
      'Complete A to unlock B',
    )
  })

  it('interpolates numeric params', () => {
    expect(tEn('discuss.round', { round: 2, max: 3 })).toBe('Round 2/3')
  })

  it('zh interpolation works', () => {
    expect(tZh('phase.lockedMsg', { prev: '讲解', next: '练习' })).toBe(
      '完成「讲解」后解锁「练习」',
    )
  })

  it('falls back to en for unknown locale', () => {
    const tFr = createT('fr' as any)
    expect(tFr('phase.listen')).toBe('Listen')
  })

  it('returns raw key for missing key', () => {
    expect(tEn('nonexistent.key' as any)).toBe('nonexistent.key')
  })

  it('leaves {param} untouched when no params provided', () => {
    const result = tEn('phase.lockedMsg')
    expect(result).toContain('{prev}')
    expect(result).toContain('{next}')
  })
})

describe('dictionary parity', () => {
  const enKeys = Object.keys(en) as (keyof typeof en)[]
  const zhKeys = Object.keys(zh) as (keyof typeof zh)[]

  it('zh has every key from en', () => {
    const missing = enKeys.filter((k) => !(k in zh))
    expect(missing).toEqual([])
  })

  it('no extra keys in zh vs en', () => {
    const extra = zhKeys.filter((k) => !(k in en))
    expect(extra).toEqual([])
  })

  it('no empty string values in en', () => {
    const empty = enKeys.filter((k) => en[k].length === 0)
    expect(empty).toEqual([])
  })

  it('no empty string values in zh', () => {
    const empty = zhKeys.filter((k) => zh[k].length === 0)
    expect(empty).toEqual([])
  })
})

describe('placeholder consistency', () => {
  const paramRe = /\{(\w+)\}/g

  function extractParams(s: string): Set<string> {
    const out = new Set<string>()
    for (const m of s.matchAll(paramRe)) out.add(m[1])
    return out
  }

  it('zh has same {param} names as en for parameterized keys', () => {
    // {s} is an English-only plural suffix — Chinese doesn't use it
    const ignoredParams = new Set(['s'])
    const mismatches: string[] = []
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      const enParams = new Set(
        [...extractParams(en[key])].filter((p) => !ignoredParams.has(p)),
      )
      if (enParams.size === 0) continue
      const zhParams = new Set(
        [...extractParams(zh[key])].filter((p) => !ignoredParams.has(p)),
      )
      if (
        enParams.size !== zhParams.size ||
        ![...enParams].every((p) => zhParams.has(p))
      ) {
        mismatches.push(
          `${key}: en={${[...enParams]}} zh={${[...zhParams]}}`,
        )
      }
    }
    expect(mismatches).toEqual([])
  })

  it('all parameterized en keys have non-empty zh translations', () => {
    const empty: string[] = []
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      if (extractParams(en[key]).size > 0 && zh[key].length === 0) {
        empty.push(key)
      }
    }
    expect(empty).toEqual([])
  })
})

describe('LocaleCtx default', () => {
  it('default context uses English locale', () => {
    // Access the default value via _currentValue (React internals) or
    // just verify the shape we passed to createContext
    const def = (LocaleCtx as any)._currentValue
    expect(def.locale).toBe('en')
    expect(def.t('phase.listen')).toBe('Listen')
  })
})
