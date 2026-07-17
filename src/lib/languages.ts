/**
 * The languages the browser's built-in model can translate into, mirroring its documented
 * list exactly. Offering anything outside it promises a translation the browser will
 * refuse, and the refusal reads to the reader as a broken extension rather than a limit.
 *
 * Copied by hand and it will drift: the list is documented as subject to change, and there
 * is no API to read it back. `Translator.availability()` stays the real gate at run time.
 */
export const SUPPORTED_TARGETS = [
  'ar',
  'bg',
  'bn',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'fi',
  'fr',
  'he',
  'hi',
  'hr',
  'hu',
  'id',
  'it',
  'ja',
  'kn',
  'ko',
  'lt',
  'mr',
  'nl',
  'no',
  'pl',
  'pt',
  'ro',
  'ru',
  'sk',
  'sl',
  'sv',
  'ta',
  'te',
  'th',
  'tr',
  'uk',
  'vi',
  'zh',
  'zh-Hant',
] as const

/**
 * The browser reports a full BCP 47 tag ('zh-Hant-TW'), while the model's list mixes bare
 * codes with one script-qualified entry. Match the longest supported prefix, so Traditional
 * Chinese is not silently answered in Simplified.
 */
export function defaultTargetLanguage(uiLanguage: string): string {
  const parts = uiLanguage.toLowerCase().split('-').filter((part) => part !== '')

  for (let length = parts.length; length > 0; length--) {
    const candidate = parts.slice(0, length).join('-')
    const supported = SUPPORTED_TARGETS.find((code) => code.toLowerCase() === candidate)
    if (supported !== undefined) return supported
  }

  return 'en'
}

const displayNames = new Intl.DisplayNames(['en'], { type: 'language' })

export function languageLabel(code: string): string {
  try {
    return displayNames.of(code) ?? code
  } catch {
    return code
  }
}

/** Supported targets ordered the way a reader scans a list: by the name they will see. */
export function targetsByLabel(): string[] {
  return [...SUPPORTED_TARGETS].sort((a, b) => languageLabel(a).localeCompare(languageLabel(b)))
}
