import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { addEntry, hasEntry, listEntries, removeEntry, resetForTest } from './vocab-db'
import type { VocabEntry } from './vocab-types'

function entry(over: Partial<VocabEntry> = {}): VocabEntry {
  return {
    sourceText: 'hello',
    translation: 'привіт',
    sourceLanguage: 'en',
    targetLanguage: 'uk',
    addedAt: 1000,
    ...over,
  }
}

afterEach(async () => {
  await resetForTest()
})

describe('vocab-db', () => {
  it('adds an entry and finds it by key', async () => {
    expect(await addEntry(entry())).toBe('added')
    expect(await hasEntry({ sourceText: 'hello', sourceLanguage: 'en', targetLanguage: 'uk' })).toBe(true)
  })

  it('does not duplicate the same (text, source, target)', async () => {
    expect(await addEntry(entry({ addedAt: 1 }))).toBe('added')
    expect(await addEntry(entry({ addedAt: 2, translation: 'other' }))).toBe('exists')
    expect(await listEntries()).toHaveLength(1)
  })

  it('treats a different target language as a separate entry', async () => {
    await addEntry(entry({ targetLanguage: 'uk' }))
    await addEntry(entry({ targetLanguage: 'de', translation: 'hallo' }))
    expect(await listEntries()).toHaveLength(2)
  })

  it('lists entries newest-first by addedAt', async () => {
    await addEntry(entry({ sourceText: 'one', addedAt: 100 }))
    await addEntry(entry({ sourceText: 'two', addedAt: 300 }))
    await addEntry(entry({ sourceText: 'three', addedAt: 200 }))
    const texts = (await listEntries()).map((e) => e.sourceText)
    expect(texts).toEqual(['two', 'three', 'one'])
  })

  it('removes an entry by key', async () => {
    await addEntry(entry())
    await removeEntry({ sourceText: 'hello', sourceLanguage: 'en', targetLanguage: 'uk' })
    expect(await hasEntry({ sourceText: 'hello', sourceLanguage: 'en', targetLanguage: 'uk' })).toBe(false)
    expect(await listEntries()).toHaveLength(0)
  })

  it('reports absence for an unknown key', async () => {
    expect(await hasEntry({ sourceText: 'ghost', sourceLanguage: 'en', targetLanguage: 'uk' })).toBe(false)
  })
})
