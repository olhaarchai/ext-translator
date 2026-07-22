import { describe, expect, it } from 'vitest'
import {
  bergamotRegistry,
  downloadSize,
  filesFor,
  MODEL_BASE_URL,
  modelsFor,
  offlineSourceLanguages,
  offlineTargetLanguages,
} from './registry'

describe('modelsFor', () => {
  it('returns the direct model when the pair exists', () => {
    expect(modelsFor('en', 'ru')).toEqual([{ from: 'en', to: 'ru' }])
  })

  it('pivots through English when there is no direct model', () => {
    expect(modelsFor('de', 'ru')).toEqual([
      { from: 'de', to: 'en' },
      { from: 'en', to: 'ru' },
    ])
  })

  it('returns null when a pivot leg is missing', () => {
    // Icelandic exists only towards English; nothing can reach it as a target.
    expect(modelsFor('en', 'is')).toBeNull()
    expect(modelsFor('de', 'is')).toBeNull()
  })

  it('returns null for identical languages', () => {
    expect(modelsFor('en', 'en')).toBeNull()
  })
})

describe('filesFor', () => {
  it('pins an absolute url, a size and a hash for every file', () => {
    const files = filesFor({ from: 'en', to: 'ru' })
    expect(files.length).toBeGreaterThanOrEqual(3)
    for (const file of files) {
      expect(file.url.startsWith(`${MODEL_BASE_URL}/enru/`)).toBe(true)
      expect(file.size).toBeGreaterThan(0)
      expect(file.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('excludes quality-estimation models from downloads', () => {
    const files = filesFor({ from: 'en', to: 'cs' })
    expect(files.some((file) => file.url.includes('qualityModel'))).toBe(false)
    expect(files.some((file) => file.url.includes('quality'))).toBe(false)
  })

  it('returns nothing for an unknown pair', () => {
    expect(filesFor({ from: 'xx', to: 'yy' })).toEqual([])
  })
})

describe('downloadSize', () => {
  it('sums both pivot legs', () => {
    const direct = downloadSize([{ from: 'de', to: 'en' }])
    const pivoted = downloadSize([
      { from: 'de', to: 'en' },
      { from: 'en', to: 'ru' },
    ])
    expect(direct).toBeGreaterThan(0)
    expect(pivoted).toBeGreaterThan(direct)
  })
})

describe('language lists', () => {
  it('offers every registry source, including one-way languages', () => {
    const sources = offlineSourceLanguages()
    expect(sources).toContain('is')
    expect(sources).toContain('en')
  })

  it('offers only reachable targets', () => {
    const targets = offlineTargetLanguages()
    expect(targets).toContain('en')
    expect(targets).toContain('ru')
    expect(targets).not.toContain('is')
  })
})

describe('bergamotRegistry', () => {
  it('exposes pairs with absolute file urls in the library shape', () => {
    const entries = bergamotRegistry()
    const enru = entries.find((entry) => entry.from === 'en' && entry.to === 'ru')
    expect(enru).toBeDefined()
    expect(enru?.files['model']?.name).toBe(`${MODEL_BASE_URL}/enru/model.enru.intgemm.alphas.bin`)
    expect(enru?.files['model']?.expectedSha256Hash).toMatch(/^[0-9a-f]{64}$/)
  })
})
