// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { expandableText } from './expandable-text'

/**
 * happy-dom has no layout, so every element reports zero height. Overflow is therefore
 * stated explicitly: that is exactly the signal the component reads at click time.
 */
function setOverflow(node: HTMLElement, overflowing: boolean): void {
  Object.defineProperty(node, 'clientHeight', { value: 40, configurable: true })
  Object.defineProperty(node, 'scrollHeight', { value: overflowing ? 80 : 40, configurable: true })
}

function inOption(content: string, overflowing: boolean) {
  const answered = vi.fn()
  const button = document.createElement('button')
  button.addEventListener('click', answered)
  button.append(expandableText('span', 'option-text', content))
  document.body.replaceChildren(button)

  const text = button.querySelector('.option-text') as HTMLElement
  const hint = button.querySelector('.clamped-hint') as HTMLElement | null
  setOverflow(text, overflowing)
  return { answered, text, hint, button }
}

describe('expandableText', () => {
  it('carries the full text even while clamped, so comparisons never see the short form', () => {
    const long = 'a very long sentence '.repeat(20)
    const { text } = inOption(long, true)
    expect(text.classList.contains('clamped')).toBe(true)
    expect(text.textContent).toBe(long)
  })

  it('expands on click and collapses on a second click', () => {
    const { text } = inOption('long '.repeat(50), true)

    text.click()
    expect(text.classList.contains('clamped')).toBe(false)

    text.click()
    expect(text.classList.contains('clamped')).toBe(true)
  })

  it('does not let an expanding click reach the option button', () => {
    const { answered, text } = inOption('long '.repeat(50), true)

    text.click()

    expect(answered).not.toHaveBeenCalled()
    expect(text.classList.contains('clamped')).toBe(false)
  })

  it('toggles from the hint as well, without answering', () => {
    const { answered, hint } = inOption('long '.repeat(50), true)

    hint!.click()

    expect(answered).not.toHaveBeenCalled()
    expect(hint!.textContent).toBe('Show less')
  })

  it('lets the click answer the option when the text fits, without waiting for a frame', () => {
    // The dead-option bug: a short text swallowed the click and the option never answered.
    // Correctness must not depend on requestAnimationFrame, which a hidden panel may
    // never get.
    const { answered, text } = inOption('короткий', false)

    text.click()

    expect(answered).toHaveBeenCalledOnce()
  })

  it('never offers to expand a single word, without needing a frame to measure', () => {
    // The side panel bug: "Show more" hung under "History". A panel may render before it
    // is painted, so this must hold with no requestAnimationFrame having run at all.
    const wrap = expandableText('div', 'entry-source', 'History')
    document.body.replaceChildren(wrap)

    const text = wrap.querySelector('.entry-source') as HTMLElement
    expect(wrap.querySelector('.clamped-hint')).toBeNull()
    expect(text.classList.contains('clamped')).toBe(false)
    expect(text.classList.contains('expandable')).toBe(false)
  })

  it('still clamps text long enough to need it', () => {
    const wrap = expandableText('div', 'entry-source', 'x'.repeat(200))
    document.body.replaceChildren(wrap)

    expect(wrap.querySelector('.clamped-hint')).not.toBeNull()
    expect((wrap.querySelector('.entry-source') as HTMLElement).classList.contains('clamped')).toBe(true)
  })

  it('drops the affordance once it knows the text fits', () => {
    const { text, button } = inOption('короткий', false)

    text.click()

    expect(text.classList.contains('expandable')).toBe(false)
    expect(text.classList.contains('clamped')).toBe(false)
    expect(button.querySelector('.clamped-hint')).toBeNull()
  })
})
