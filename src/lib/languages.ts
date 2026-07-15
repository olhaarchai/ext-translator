export const SUPPORTED_TARGETS = [
  'en',
  'uk',
  'de',
  'fr',
  'es',
  'it',
  'pt',
  'pl',
  'nl',
  'cs',
  'sk',
  'ro',
  'hu',
  'bg',
  'el',
  'sv',
  'da',
  'fi',
  'lt',
  'lv',
  'et',
  'tr',
  'ru',
  'ar',
  'hi',
  'ja',
  'ko',
  'zh',
  'vi',
  'th',
  'id',
] as const

export function normalizeLanguageTag(tag: string): string {
  return tag.toLowerCase().split('-')[0] ?? ''
}

export function defaultTargetLanguage(uiLanguage: string): string {
  const base = normalizeLanguageTag(uiLanguage)
  return (SUPPORTED_TARGETS as readonly string[]).includes(base) ? base : 'en'
}

const displayNames = new Intl.DisplayNames(['en'], { type: 'language' })

export function languageLabel(code: string): string {
  try {
    return displayNames.of(code) ?? code
  } catch {
    return code
  }
}
