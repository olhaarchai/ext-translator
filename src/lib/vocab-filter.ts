import type { VocabEntry } from './vocab-types'

export function filterEntries(entries: VocabEntry[], query: string): VocabEntry[] {
  const q = query.trim().toLowerCase()
  if (q === '') return entries
  return entries.filter(
    (entry) =>
      entry.sourceText.toLowerCase().includes(q) || entry.translation.toLowerCase().includes(q),
  )
}
