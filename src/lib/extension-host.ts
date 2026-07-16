/**
 * The host elements live in the page's DOM, so page CSS can target them even though their
 * shadow roots are closed. A fixed id makes that a one-liner, and page rules beat our
 * `:host` rules — hence a per-load random id plus inline !important on the properties that
 * could hide or displace our UI.
 */

/**
 * Deliberately carries no recognisable prefix: a shared one would just move the handle
 * from `#ext-translator-host` to `[id^="ext-translator"]`.
 */
export function randomHostId(): string {
  // crypto.randomUUID needs a secure context; plain http pages fall back.
  const token = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `x${token.replace(/-/g, '')}`
}

const PROTECTED: ReadonlyArray<readonly [string, string]> = [
  ['display', 'block'],
  ['position', 'static'],
  ['transform', 'none'],
  ['filter', 'none'],
  ['opacity', '1'],
  ['visibility', 'visible'],
  ['contain', 'none'],
  ['pointer-events', 'auto'],
]

export function hardenHost(host: HTMLElement): void {
  for (const [property, value] of PROTECTED) {
    host.style.setProperty(property, value, 'important')
  }
}
