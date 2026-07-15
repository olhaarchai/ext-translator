import { describe, expect, it } from 'vitest'
import { defaultTargetLanguage, languageLabel, normalizeLanguageTag } from './languages'

describe('normalizeLanguageTag', () => {
  it('lowercases and strips the region subtag', () => {
    expect(normalizeLanguageTag('uk-UA')).toBe('uk')
    expect(normalizeLanguageTag('EN')).toBe('en')
    expect(normalizeLanguageTag('')).toBe('')
  })
})

describe('defaultTargetLanguage', () => {
  it('uses the UI language when supported', () => {
    expect(defaultTargetLanguage('uk-UA')).toBe('uk')
    expect(defaultTargetLanguage('de')).toBe('de')
  })

  it('falls back to English for unsupported languages', () => {
    expect(defaultTargetLanguage('tlh')).toBe('en')
    expect(defaultTargetLanguage('')).toBe('en')
  })
})

describe('languageLabel', () => {
  it('returns a readable name for known codes', () => {
    expect(languageLabel('uk')).toBe('Ukrainian')
  })

  it('falls back to the code itself for invalid tags', () => {
    expect(languageLabel('???')).toBe('???')
  })
})
