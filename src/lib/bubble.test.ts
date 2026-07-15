// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./settings', () => ({
  hasConsent: vi.fn(async () => true),
  grantConsent: vi.fn(async () => {}),
  getTargetLanguage: vi.fn(async () => 'uk'),
  setTargetLanguage: vi.fn(async () => {}),
}))

vi.mock('./translate', async (importOriginal) => {
  const original = await importOriginal<typeof import('./translate')>()
  return {
    ...original,
    translateSelection: vi.fn(async () => ({
      kind: 'result',
      translation: 'Привіт',
      sourceLanguage: 'en',
      truncated: false,
    })),
  }
})

import { bubbleRootForTest, closeBubble, openBubble } from './bubble'
import { grantConsent, hasConsent } from './settings'

const HOST_ID = 'ext-translator-host'

function root(): HTMLElement {
  const node = bubbleRootForTest()
  if (!node) throw new Error('bubble not mounted')
  return node
}

function trustedClick(node: Element): void {
  const event = new MouseEvent('click', { bubbles: true })
  Object.defineProperty(event, 'isTrusted', { value: true })
  node.dispatchEvent(event)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  closeBubble()
})

describe('bubble', () => {
  it('renders the translation when consent is already given', async () => {
    await openBubble('hello world')
    expect(root().querySelector('.translation')?.textContent).toBe('Привіт')
  })

  it('shows the disclosure first and translates only after agreeing', async () => {
    vi.mocked(hasConsent).mockResolvedValueOnce(false)
    await openBubble('hello world')

    expect(root().querySelector('.translation')).toBeNull()
    const agree = root().querySelector('button')
    expect(agree?.textContent).toBe('Agree and translate')

    if (agree) trustedClick(agree)
    await vi.waitFor(() => {
      expect(grantConsent).toHaveBeenCalled()
      expect(root().querySelector('.translation')?.textContent).toBe('Привіт')
    })
  })

  it('ignores synthetic (untrusted) clicks on the consent button', async () => {
    vi.mocked(hasConsent).mockResolvedValueOnce(false)
    await openBubble('hello world')

    root().querySelector('button')?.click()
    await Promise.resolve()
    expect(grantConsent).not.toHaveBeenCalled()
    expect(root().querySelector('.translation')).toBeNull()
  })

  it('never stacks bubbles on repeated invocations', async () => {
    await openBubble('first')
    await openBubble('second')
    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1)
  })

  it('closes on Escape', async () => {
    await openBubble('hello world')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.getElementById(HOST_ID)).toBeNull()
  })

  it('ignores empty selections', async () => {
    await openBubble('   ')
    expect(document.getElementById(HOST_ID)).toBeNull()
  })
})
