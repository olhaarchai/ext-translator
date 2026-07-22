import { describe, expect, it } from 'vitest'
import { detectSource } from './detect'

describe('detectSource', () => {
  it('detects a clearly marked language', () => {
    expect(detectSource('Zuverlässigkeit ist wichtig für unsere Systeme')).toBe('de')
    expect(detectSource('надійність дуже важлива для наших систем')).toBe('uk')
    expect(detectSource('надежность очень важна для наших систем')).toBe('ru')
  })

  it('falls back to English for a single Latin-script word detection cannot place', () => {
    // tinyld returns nothing at all for these; without the fallback the user hit a
    // detection-failed dead end on the most common case — looking up one English word.
    expect(detectSource('reliability')).toBe('en')
    expect(detectSource('benchmark')).toBe('en')
  })

  it('rejects a weak guess on a single Latin word in favour of English', () => {
    // Scored 0.1 as Spanish, which downloaded a Spanish model for an English word.
    expect(detectSource('recognized')).toBe('en')
  })

  it('keeps a strong single-word signal', () => {
    expect(detectSource('fenêtre')).toBe('fr')
    expect(detectSource('Zuverlässigkeit')).toBe('de')
  })

  it('detects short common words instead of exotic false positives', () => {
    expect(detectSource('cat')).toBe('en')
  })

  it('maps the Norwegian macrolanguage code to the registry variant', () => {
    expect(detectSource('God morgen, hvordan har du det i dag')).toBe('nb')
  })

  it('detects single Cyrillic words without guessing', () => {
    expect(detectSource('надійність')).toBe('uk')
  })

  it('returns null for scripts the registry cannot serve', () => {
    expect(detectSource('こんにちは世界')).toBeNull()
  })
})
