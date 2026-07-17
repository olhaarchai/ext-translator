import { describe, expect, it } from 'vitest'
import { SUPPORTED_TARGETS, defaultTargetLanguage, languageLabel, targetsByLabel } from './languages'

describe('SUPPORTED_TARGETS', () => {
  it('offers nothing the built-in model cannot produce', () => {
    // Estonian and Latvian were offered in the picker and the model refused them, which
    // read as a broken extension. Neither is in the browser's documented list.
    expect(SUPPORTED_TARGETS).not.toContain('et')
    expect(SUPPORTED_TARGETS).not.toContain('lv')
  })

  it('lists every language the model does support', () => {
    const documented = [
      'ar', 'bg', 'bn', 'cs', 'da', 'de', 'el', 'en', 'es', 'fi', 'fr', 'he', 'hi', 'hr',
      'hu', 'id', 'it', 'ja', 'kn', 'ko', 'lt', 'mr', 'nl', 'no', 'pl', 'pt', 'ro', 'ru',
      'sk', 'sl', 'sv', 'ta', 'te', 'th', 'tr', 'uk', 'vi', 'zh', 'zh-Hant',
    ]
    expect([...SUPPORTED_TARGETS]).toEqual(documented)
  })

  it('has no duplicates', () => {
    expect(new Set(SUPPORTED_TARGETS).size).toBe(SUPPORTED_TARGETS.length)
  })
})

describe('defaultTargetLanguage', () => {
  it('uses the UI language when supported', () => {
    expect(defaultTargetLanguage('uk-UA')).toBe('uk')
    expect(defaultTargetLanguage('de')).toBe('de')
  })

  it('keeps Traditional Chinese instead of collapsing it into Simplified', () => {
    expect(defaultTargetLanguage('zh-Hant-TW')).toBe('zh-Hant')
    expect(defaultTargetLanguage('zh-Hant')).toBe('zh-Hant')
  })

  it('still reaches Simplified Chinese from a plain or regional tag', () => {
    expect(defaultTargetLanguage('zh')).toBe('zh')
    expect(defaultTargetLanguage('zh-CN')).toBe('zh')
  })

  it('falls back to English for unsupported languages', () => {
    expect(defaultTargetLanguage('tlh')).toBe('en')
    expect(defaultTargetLanguage('')).toBe('en')
    // Estonian is a real language the model does not have; it must not be guessed at.
    expect(defaultTargetLanguage('et-EE')).toBe('en')
  })
})

describe('targetsByLabel', () => {
  it('orders by the name the reader sees, not by code', () => {
    const labels = targetsByLabel().map(languageLabel)
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)))
  })

  it('keeps every supported language', () => {
    expect(new Set(targetsByLabel())).toEqual(new Set(SUPPORTED_TARGETS))
  })
})

describe('languageLabel', () => {
  it('returns a readable name for known codes', () => {
    expect(languageLabel('uk')).toBe('Ukrainian')
  })

  it('distinguishes the Chinese variants', () => {
    expect(languageLabel('zh-Hant')).not.toBe(languageLabel('zh'))
  })

  it('falls back to the code itself for invalid tags', () => {
    expect(languageLabel('???')).toBe('???')
  })
})
