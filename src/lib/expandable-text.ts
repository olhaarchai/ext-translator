/**
 * Text clamped to two lines that expands in place.
 *
 * The element always carries the full text; clamping is visual only, so anything that
 * compares or reads it never sees the shortened form.
 *
 * The expand control is handed back separately rather than nested inside the text. Inside
 * an option <button> a nested control is invalid HTML, stops firing the moment the button
 * is disabled, and — because the clamped text fills the button — leaves nothing but the
 * padding to click. Callers place the hint where nothing else competes for the click.
 */

/**
 * Text this short cannot fill two lines in any realistic panel width, so it is settled up
 * front. Measuring would say the same, but measurement needs a laid-out frame — and a side
 * panel does not reliably get one before it is painted, which left "Show more" hanging
 * under single words.
 */
const NEVER_CLAMPED_CHARS = 60

export interface Clamped {
  text: HTMLElement
  /** null when the text is short enough that it can never need expanding. */
  hint: HTMLElement | null
  /** Expands or collapses. A no-op once the text has proved it fits. */
  toggle: () => void
}

export function clampedText(tag: string, className: string, content: string): Clamped {
  const text = document.createElement(tag)
  text.className = className
  text.textContent = content

  if (content.length <= NEVER_CLAMPED_CHARS) {
    return { text, hint: null, toggle: () => {} }
  }

  text.classList.add('clamped')

  const hint = document.createElement('button')
  hint.type = 'button'
  hint.className = 'more clamped-hint'
  hint.textContent = 'Show more'

  let settled = false
  const overflows = () => text.scrollHeight > text.clientHeight + 1

  const settle = () => {
    settled = true
    text.classList.remove('clamped', 'expandable')
    text.removeAttribute('title')
    hint.remove()
  }

  const toggle = () => {
    if (settled) return
    // Measured now, not at build time: layout is only reliable once the element is on
    // screen, and a panel rendered while hidden may never get an animation frame.
    if (text.classList.contains('clamped') && !overflows()) {
      settle()
      return
    }
    const clamped = text.classList.toggle('clamped')
    hint.textContent = clamped ? 'Show more' : 'Show less'
    text.title = clamped ? 'Click to expand' : 'Click to collapse'
  }

  hint.addEventListener('click', toggle)

  // Measure once the element is genuinely rendered. requestAnimationFrame was wrong in both
  // directions: in a side panel painted late it never ran, leaving "Show more" under single
  // words; in a normal tab it ran before layout, read zero heights and stripped clamping
  // from text that did overflow. An intersection only fires when there is a box to measure.
  if (typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver((records, self) => {
      if (!records.some((record) => record.isIntersecting)) return
      self.disconnect()
      if (!overflows()) settle()
    })
    observer.observe(text)
  }

  return { text, hint, toggle }
}

/**
 * Self-contained clamped text for places where nothing else owns the click, so the text
 * itself expands as well as the hint.
 */
export function expandableText(tag: string, className: string, content: string): HTMLElement {
  const { text, hint, toggle } = clampedText(tag, className, content)
  const wrap = document.createElement('div')
  wrap.append(text)

  if (hint !== null) {
    text.classList.add('expandable')
    text.title = 'Click to expand'
    text.addEventListener('click', toggle)
    wrap.append(hint)
  }

  return wrap
}
