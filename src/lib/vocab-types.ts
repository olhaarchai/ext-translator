export interface VocabEntry {
  sourceText: string
  translation: string
  sourceLanguage: string
  targetLanguage: string
  addedAt: number
}

export interface VocabKey {
  sourceText: string
  sourceLanguage: string
  targetLanguage: string
}

export function normalizeSourceText(text: string): string {
  return text.trim()
}

export function keyOf(entry: VocabEntry | VocabKey): VocabKey {
  return {
    sourceText: entry.sourceText,
    sourceLanguage: entry.sourceLanguage,
    targetLanguage: entry.targetLanguage,
  }
}
