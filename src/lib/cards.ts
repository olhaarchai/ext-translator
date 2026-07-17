import type { VocabEntry } from './vocab-types'

export const OPTIONS_PER_CARD = 4
export const MIN_DISTINCT_TRANSLATIONS = OPTIONS_PER_CARD

export interface Card {
  entry: VocabEntry
  /** The entry's own translation plus distractors, already shuffled. */
  options: string[]
  answer: string
}

type Shuffle = <T>(items: T[]) => T[]

const shuffleRandom: Shuffle = (items) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

export function entriesFor(entries: VocabEntry[], targetLanguage: string): VocabEntry[] {
  return entries.filter((entry) => entry.targetLanguage === targetLanguage)
}

/**
 * Eligibility counts DISTINCT translations, not entries: two entries can share a
 * translation, and a card needs the answer plus three wrong options that all read
 * differently. Four entries with only three distinct translations cannot fill a card.
 */
function distinctTranslations(entries: VocabEntry[]): Set<string> {
  return new Set(entries.map((entry) => entry.translation))
}

export function canTrain(entries: VocabEntry[], targetLanguage: string): boolean {
  return distinctTranslations(entriesFor(entries, targetLanguage)).size >= MIN_DISTINCT_TRANSLATIONS
}

/**
 * The language closest to being trainable, so the UI can say what is actually missing
 * instead of restating the rule. Null when nothing is saved at all.
 */
export function closestToTrainable(
  entries: VocabEntry[],
): { language: string; distinct: number; missing: number } | null {
  const byLanguage = new Map<string, VocabEntry[]>()
  for (const entry of entries) {
    const bucket = byLanguage.get(entry.targetLanguage)
    if (bucket) bucket.push(entry)
    else byLanguage.set(entry.targetLanguage, [entry])
  }

  let best: { language: string; distinct: number; missing: number } | null = null
  for (const [language, group] of byLanguage) {
    const distinct = distinctTranslations(group).size
    if (best === null || distinct > best.distinct) {
      best = { language, distinct, missing: Math.max(0, MIN_DISTINCT_TRANSLATIONS - distinct) }
    }
  }
  return best
}

/** Target languages with enough distinct translations to train on, richest first. */
export function trainableLanguages(entries: VocabEntry[]): string[] {
  const byLanguage = new Map<string, VocabEntry[]>()
  for (const entry of entries) {
    const bucket = byLanguage.get(entry.targetLanguage)
    if (bucket) bucket.push(entry)
    else byLanguage.set(entry.targetLanguage, [entry])
  }

  return [...byLanguage.entries()]
    .map(([lang, group]) => ({ lang, distinct: distinctTranslations(group).size }))
    .filter(({ distinct }) => distinct >= MIN_DISTINCT_TRANSLATIONS)
    .sort((a, b) => b.distinct - a.distinct)
    .map(({ lang }) => lang)
}

/** One card per eligible entry, in random order. */
export function buildSession(
  entries: VocabEntry[],
  targetLanguage: string,
  shuffle: Shuffle = shuffleRandom,
): Card[] {
  const pool = entriesFor(entries, targetLanguage)
  if (distinctTranslations(pool).size < MIN_DISTINCT_TRANSLATIONS) return []

  return shuffle(pool).map((entry) => {
    const answer = entry.translation
    const distractors: string[] = []
    const seen = new Set([answer])

    for (const candidate of shuffle(pool)) {
      if (distractors.length === OPTIONS_PER_CARD - 1) break
      if (seen.has(candidate.translation)) continue
      seen.add(candidate.translation)
      distractors.push(candidate.translation)
    }

    return { entry, answer, options: shuffle([answer, ...distractors]) }
  })
}
