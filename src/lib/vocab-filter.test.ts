import { describe, expect, it } from 'vitest'
import { filterEntries } from './vocab-filter'
import type { VocabEntry } from './vocab-types'

const entries: VocabEntry[] = [
  { sourceText: 'hello', translation: 'привіт', sourceLanguage: 'en', targetLanguage: 'uk', addedAt: 1 },
  { sourceText: 'world', translation: 'світ', sourceLanguage: 'en', targetLanguage: 'uk', addedAt: 2 },
]

describe('filterEntries', () => {
  it('returns everything for an empty or whitespace query', () => {
    expect(filterEntries(entries, '')).toHaveLength(2)
    expect(filterEntries(entries, '   ')).toHaveLength(2)
  })

  it('matches the source text case-insensitively', () => {
    expect(filterEntries(entries, 'HELLO').map((e) => e.sourceText)).toEqual(['hello'])
  })

  it('matches the translation too', () => {
    expect(filterEntries(entries, 'світ').map((e) => e.sourceText)).toEqual(['world'])
  })

  it('returns nothing when there is no match', () => {
    expect(filterEntries(entries, 'zzz')).toHaveLength(0)
  })
})
