// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { clampedText, expandableText } from './expandable-text'

/**
 * happy-dom has no layout, so every element reports zero height. Overflow is therefore
 * stated explicitly: that is exactly the signal the component reads at click time.
 */
function setOverflow(node: HTMLElement, overflowing: boolean): void {
  Object.defineProperty(node, 'clientHeight', { value: 40, configurable: true })
  Object.defineProperty(node, 'scrollHeight', { value: overflowing ? 80 : 40, configurable: true })
}

const LONG = 'long sentence '.repeat(10)
// Past the short-circuit, so a hint is built, yet still able to fit two lines.
const LONGISH = 'x'.repeat(70)

function vocabRow(content: string, overflowing: boolean) {
  const wrap = expandableText('div', 'entry-source', content)
  document.body.replaceChildren(wrap)
  const text = wrap.querySelector('.entry-source') as HTMLElement
  setOverflow(text, overflowing)
  return { wrap, text, hint: wrap.querySelector('.clamped-hint') as HTMLElement | null }
}

function option(content: string, overflowing: boolean) {
  const answered = vi.fn()
  const { text, hint, toggle } = clampedText('span', 'option-text', content)
  const button = document.createElement('button')
  button.addEventListener('click', answered)
  button.append(text)

  const wrap = document.createElement('div')
  wrap.append(button)
  if (hint) wrap.append(hint)
  document.body.replaceChildren(wrap)

  setOverflow(text, overflowing)
  return { answered, text, hint, button, toggle }
}

describe('clampedText', () => {
  it('carries the full text even while clamped, so comparisons never see the short form', () => {
    const { text } = option(LONG, true)
    expect(text.classList.contains('clamped')).toBe(true)
    expect(text.textContent).toBe(LONG)
  })

  it('hands the hint back instead of nesting it, so it can live outside the button', () => {
    const { button, hint } = option(LONG, true)
    expect(hint).not.toBeNull()
    expect(button.contains(hint)).toBe(false)
  })

  it('offers no hint for text too short to ever need one', () => {
    const { hint } = option('короткий', false)
    expect(hint).toBeNull()
  })

  it('answers on the first click on the text, even when the text is long enough to clamp', () => {
    // The dead-click bug: the text competed with the button for the click and won,
    // swallowing the answer. Inside an option nothing may intercept the text.
    const { answered, text } = option(LONG, true)

    text.click()

    expect(answered).toHaveBeenCalledOnce()
  })

  it('answers on the first click when the text is past the short-circuit but still fits', () => {
    // This is the case the old test missed: it used a string under the short-circuit, so
    // no handler was ever attached and it passed without exercising anything.
    const { answered, text } = option(LONGISH, false)

    text.click()

    expect(answered).toHaveBeenCalledOnce()
  })

  it('expands from the hint without answering, and collapses again', () => {
    const { answered, hint } = option(LONG, true)

    hint!.click()
    expect(hint!.textContent).toBe('Show less')

    hint!.click()
    expect(hint!.textContent).toBe('Show more')
    expect(answered).not.toHaveBeenCalled()
  })

  it('keeps the hint working after the option is marked answered', () => {
    // The option is never disabled precisely so this keeps working: a disabled button
    // silences its own descendants, and the reader still wants to read the full answer.
    const { button, hint, text } = option(LONG, true)
    button.classList.add('answered')

    hint!.click()

    expect(text.classList.contains('clamped')).toBe(false)
  })

  it('drops the hint once the text proves it fits', () => {
    const { hint, text, toggle } = option(LONGISH, false)

    toggle()

    expect(hint!.isConnected).toBe(false)
    expect(text.classList.contains('clamped')).toBe(false)
  })

  it('never re-clamps text that has proved it fits', () => {
    // The stale-handler bug: once settled, a further toggle re-added the clamp, which
    // stripped the hint's meaning and swallowed a click for nothing.
    const { text, toggle } = option(LONGISH, false)

    toggle()
    toggle()

    expect(text.classList.contains('clamped')).toBe(false)
  })
})

describe('expandableText', () => {
  it('expands on a click on the text itself, where nothing else owns the click', () => {
    const { text } = vocabRow(LONG, true)

    text.click()
    expect(text.classList.contains('clamped')).toBe(false)

    text.click()
    expect(text.classList.contains('clamped')).toBe(true)
  })

  it('never offers to expand a single word, without needing a frame to measure', () => {
    // The side panel bug: "Show more" hung under "History". A panel may render before it
    // is painted, so this must hold with no measurement having run at all.
    const { wrap, text } = vocabRow('History', false)

    expect(wrap.querySelector('.clamped-hint')).toBeNull()
    expect(text.classList.contains('clamped')).toBe(false)
    expect(text.classList.contains('expandable')).toBe(false)
  })

  it('still clamps text long enough to need it', () => {
    const { hint, text } = vocabRow('x'.repeat(200), true)

    expect(hint).not.toBeNull()
    expect(text.classList.contains('clamped')).toBe(true)
  })

  it('settles into plain text on the first click once it knows the text fits', () => {
    const { text, hint } = vocabRow(LONGISH, false)

    text.click()

    expect(text.classList.contains('clamped')).toBe(false)
    expect(text.classList.contains('expandable')).toBe(false)
    expect(hint!.isConnected).toBe(false)
  })
})
