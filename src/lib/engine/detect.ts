import { detectAll } from 'tinyld'
import { offlineSourceLanguages } from './registry'

// tinyld reports macrolanguage codes for a few languages the registry lists by variant.
const DETECTION_ALIASES: Record<string, string> = { no: 'nb' }

const LATIN_TEXT = /^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]+$/u

/**
 * On a single word a real hit scores near 1.0 ('fenêtre' → fr) while noise scores an
 * order of magnitude lower ('recognized' → es at 0.1, which once downloaded a Spanish
 * model for an English word). Below this line the English fallback is the better bet.
 */
const SINGLE_WORD_MIN_ACCURACY = 0.3

/**
 * Restricting detection to the languages the registry can actually serve sharpens it
 * dramatically on short input (unrestricted, 'cat' reads as Romanian).
 */
export function detectSource(text: string): string | null {
  const sources = offlineSourceLanguages()
  const sourceSet = new Set(sources)
  const only = [...sources, ...Object.keys(DETECTION_ALIASES)]
  const latin = LATIN_TEXT.test(text)
  const singleWord = !/\s/.test(text.trim())

  for (const { lang, accuracy } of detectAll(text, { only })) {
    const candidate = DETECTION_ALIASES[lang] ?? lang
    if (!sourceSet.has(candidate)) continue
    if (latin && singleWord && accuracy < SINGLE_WORD_MIN_ACCURACY) break
    return candidate
  }

  // Statistical detection starves on a single short word ('reliability' yields nothing
  // at all). For Latin-script text, English is the dominant guess and the hub every
  // pair pivots through; the bubble header shows the guessed language, so a wrong guess
  // is visible rather than silent. Non-Latin scripts detect reliably even for single
  // words, so the best candidate is kept and no guess is made beyond it.
  if (latin) return 'en'
  return null
}
