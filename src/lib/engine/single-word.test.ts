import { describe, expect, it } from 'vitest'
import { unwrapSingleWord, wrapSingleWord } from './single-word'

describe('wrapSingleWord', () => {
  it('shapes a bare lowercase word into a sentence', () => {
    expect(wrapSingleWord('troubling')).toEqual({ wrapped: 'Troubling.', loweredFirst: true })
  })

  it('keeps an already capitalized word as-is, only adding the period', () => {
    expect(wrapSingleWord('Fenster')).toEqual({ wrapped: 'Fenster.', loweredFirst: false })
  })

  it('ignores multi-word selections', () => {
    expect(wrapSingleWord('machine learning')).toBeNull()
  })

  it('ignores words already carrying trailing punctuation', () => {
    expect(wrapSingleWord('troubling.')).toBeNull()
    expect(wrapSingleWord('troubling,')).toBeNull()
  })

  it('ignores empty selections', () => {
    expect(wrapSingleWord('   ')).toBeNull()
  })
})

describe('unwrapSingleWord', () => {
  it('strips the added period and restores the original casing', () => {
    const wrap = wrapSingleWord('troubling')!
    expect(unwrapSingleWord('Беспокойно.', wrap)).toBe('беспокойно')
  })

  it('keeps capitalization when the original word was capitalized', () => {
    const wrap = wrapSingleWord('Fenster')!
    expect(unwrapSingleWord('Window.', wrap)).toBe('Window')
  })

  it('handles a translation without the trailing period', () => {
    const wrap = wrapSingleWord('troubling')!
    expect(unwrapSingleWord('Беспокойно', wrap)).toBe('беспокойно')
  })
})
