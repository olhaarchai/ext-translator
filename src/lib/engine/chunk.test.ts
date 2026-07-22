import { describe, expect, it } from 'vitest'
import { isPassthrough, splitForStreaming } from './chunk'

describe('splitForStreaming', () => {
  it('keeps a short text as a single chunk', () => {
    expect(splitForStreaming('Hallo Welt.')).toEqual(['Hallo Welt.'])
  })

  it('preserves newline runs as passthrough chunks', () => {
    const chunks = splitForStreaming('One.\n\nTwo.')
    expect(chunks).toEqual(['One.', '\n\n', 'Two.'])
    expect(chunks.map(isPassthrough)).toEqual([false, true, false])
  })

  it('splits an oversized paragraph at sentence boundaries', () => {
    const sentence = `${'word '.repeat(100)}end.`
    const text = Array.from({ length: 5 }, () => sentence).join(' ')
    const chunks = splitForStreaming(text)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1200)
    }
  })

  it('keeps a single sentence longer than the cap intact rather than dropping it', () => {
    const monster = 'a'.repeat(3000)
    expect(splitForStreaming(monster)).toEqual([monster])
  })

  it('reassembles to the original text modulo collapsed inter-sentence spaces', () => {
    const text = 'One. Two!\nThree?'
    const chunks = splitForStreaming(text)
    const rejoined = chunks.reduce(
      (acc, chunk, index) =>
        acc + (index > 0 && !isPassthrough(chunk) && !isPassthrough(chunks[index - 1]!) ? ' ' : '') + chunk,
      '',
    )
    expect(rejoined).toBe(text)
  })
})
