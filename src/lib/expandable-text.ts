/**
 * Text that is clamped to a couple of lines and expands in place when activated.
 *
 * Two invariants:
 * - The element always carries the full text; clamping is visual only, so anything that
 *   compares or reads it never sees the shortened form.
 * - It only swallows a click when there is genuinely something to expand. These live
 *   inside option buttons, where swallowing a click would make the option unanswerable.
 */
/**
 * Text this short cannot fill two lines in any realistic panel width, so it is settled up
 * front. Measuring would say the same, but measurement needs a laid-out frame — and a side
 * panel does not reliably get one before it is painted, which left "Show more" hanging
 * under single words.
 */
const NEVER_CLAMPED_CHARS = 60

export function expandableText(tag: string, className: string, content: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = `${className} clamped expandable`
  node.textContent = content
  node.title = 'Click to expand'

  if (content.length <= NEVER_CLAMPED_CHARS) {
    node.classList.remove('clamped', 'expandable')
    node.removeAttribute('title')
    const plain = document.createElement('div')
    plain.append(node)
    return plain
  }

  const hint = document.createElement('span')
  hint.className = 'more clamped-hint'
  hint.textContent = 'Show more'

  const wrap = document.createElement('div')
  wrap.append(node, hint)

  const overflows = () => node.scrollHeight > node.clientHeight + 1

  const settleAsPlainText = () => {
    node.classList.remove('clamped', 'expandable')
    node.removeAttribute('title')
    hint.remove()
  }

  const toggle = (event: Event) => {
    // Measured now, not at build time: layout is only reliable once it is on screen, and a
    // panel rendered while hidden may never get an animation frame.
    if (node.classList.contains('clamped') && !overflows()) {
      settleAsPlainText()
      return // ordinary text — let the click reach the option
    }

    event.stopPropagation()
    const clamped = node.classList.toggle('clamped')
    hint.textContent = clamped ? 'Show more' : 'Show less'
    node.title = clamped ? 'Click to expand' : 'Click to collapse'
  }

  node.addEventListener('click', toggle)
  hint.addEventListener('click', toggle)

  // Measure once the element is genuinely rendered. requestAnimationFrame was wrong in both
  // directions: in a side panel painted late it never ran, leaving "Show more" under single
  // words; in a normal tab it ran before layout, read zero heights and stripped clamping
  // from text that did overflow. An intersection only fires when there is a box to measure.
  if (typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver((records, self) => {
      if (!records.some((record) => record.isIntersecting)) return
      self.disconnect()
      if (!overflows()) settleAsPlainText()
    })
    observer.observe(node)
  }

  return wrap
}
