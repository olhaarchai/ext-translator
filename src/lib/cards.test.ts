import { describe, expect, it } from 'vitest'
import { buildSession, canTrain, closestToTrainable, trainableLanguages, OPTIONS_PER_CARD } from './cards'
import type { VocabEntry } from './vocab-types'

function entry(sourceText: string, translation: string, targetLanguage = 'uk'): VocabEntry {
  return { sourceText, translation, sourceLanguage: 'en', targetLanguage, addedAt: 1 }
}

// Deterministic stand-in for the shuffle, so tests assert behavior and not luck.
const identity = <T,>(items: T[]): T[] => [...items]
const reverse = <T,>(items: T[]): T[] => [...items].reverse()

const FOUR = [
  entry('one', 'один'),
  entry('two', 'два'),
  entry('three', 'три'),
  entry('four', 'чотири'),
]

describe('canTrain', () => {
  it('is false below four distinct translations', () => {
    expect(canTrain(FOUR.slice(0, 3), 'uk')).toBe(false)
  })

  it('is true at exactly four', () => {
    expect(canTrain(FOUR, 'uk')).toBe(true)
  })

  it('is false when four entries share translations, leaving three distinct', () => {
    const withDuplicate = [...FOUR.slice(0, 3), entry('vier', 'три')]
    expect(withDuplicate).toHaveLength(4)
    expect(canTrain(withDuplicate, 'uk')).toBe(false)
  })

  it('ignores entries whose target language differs', () => {
    const mixed = [...FOUR.slice(0, 3), entry('four', 'vier', 'de')]
    expect(canTrain(mixed, 'uk')).toBe(false)
  })
})

describe('trainableLanguages', () => {
  it('lists only languages with enough distinct translations, richest first', () => {
    const entries = [
      ...FOUR,
      entry('five', 'п’ять'),
      entry('eins', 'eins', 'de'),
      entry('zwei', 'zwei', 'de'),
    ]
    expect(trainableLanguages(entries)).toEqual(['uk'])
  })

  it('is empty when nothing qualifies', () => {
    expect(trainableLanguages(FOUR.slice(0, 2))).toEqual([])
  })
})

describe('closestToTrainable', () => {
  it('names the language nearest the threshold and how many are missing', () => {
    // Exactly the real case: three Russian, one Ukrainian, nothing trainable yet.
    const entries = [
      entry('History', 'История', 'ru'),
      entry('Search', 'Поиск', 'ru'),
      entry('Machine learning', 'Машинное обучение', 'ru'),
      entry('conceived', 'задуманий', 'uk'),
    ]
    expect(closestToTrainable(entries)).toEqual({ language: 'ru', distinct: 3, missing: 1 })
  })

  it('counts shared translations once, so it never promises a start that would fail', () => {
    const entries = [
      entry('one', 'один', 'ru'),
      entry('uno', 'один', 'ru'),
      entry('two', 'два', 'ru'),
    ]
    expect(closestToTrainable(entries)).toEqual({ language: 'ru', distinct: 2, missing: 2 })
  })

  it('is null with nothing saved', () => {
    expect(closestToTrainable([])).toBeNull()
  })

  it('reports nothing missing once the language qualifies', () => {
    expect(closestToTrainable(FOUR)).toEqual({ language: 'uk', distinct: 4, missing: 0 })
  })
})

describe('buildSession', () => {
  it('returns nothing when the language cannot be trained', () => {
    expect(buildSession(FOUR.slice(0, 3), 'uk', identity)).toEqual([])
  })

  it('makes one card per entry, each with four options including its own translation', () => {
    const cards = buildSession(FOUR, 'uk', identity)
    expect(cards).toHaveLength(4)
    for (const card of cards) {
      expect(card.options).toHaveLength(OPTIONS_PER_CARD)
      expect(card.options).toContain(card.answer)
      expect(card.answer).toBe(card.entry.translation)
    }
  })

  it('never repeats an option within a card', () => {
    for (const card of buildSession(FOUR, 'uk', identity)) {
      expect(new Set(card.options).size).toBe(card.options.length)
    }
  })

  it('never uses a wrong option that reads like the correct one', () => {
    // 'три' is saved twice, so it must never appear as a distractor for itself.
    const entries = [...FOUR, entry('drei', 'три')]
    for (const card of buildSession(entries, 'uk', identity)) {
      const wrong = card.options.filter((o) => o !== card.answer)
      expect(wrong).not.toContain(card.answer)
      expect(new Set(card.options).size).toBe(card.options.length)
    }
  })

  it('draws options only from the same target language', () => {
    const entries = [...FOUR, entry('five', 'fünf', 'de')]
    for (const card of buildSession(entries, 'uk', identity)) {
      expect(card.options).not.toContain('fünf')
    }
  })

  it('puts the answer in different places depending on the shuffle', () => {
    const asIs = buildSession(FOUR, 'uk', identity)
    const flipped = buildSession(FOUR, 'uk', reverse)
    const positions = (cards: ReturnType<typeof buildSession>) =>
      cards.map((c) => c.options.indexOf(c.answer))
    expect(positions(asIs)).not.toEqual(positions(flipped))
  })

  it('fills every card even at the minimum of four', () => {
    const cards = buildSession(FOUR, 'uk', identity)
    for (const card of cards) {
      expect(card.options.filter((o) => o !== card.answer)).toHaveLength(OPTIONS_PER_CARD - 1)
    }
  })
})
