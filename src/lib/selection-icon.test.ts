// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./bubble', () => ({
  openBubble: vi.fn(async () => {}),
  currentBubbleHost: vi.fn(() => null),
}))

vi.mock('./settings', () => ({
  isSelectionIconEnabled: vi.fn(async () => true),
}))

import { currentBubbleHost, openBubble } from './bubble'
import {
  hideSelectionIcon,
  installSelectionIcon,
  selectionIconButtonForTest,
  selectionIconHostForTest,
} from './selection-icon'
import { isSelectionIconEnabled } from './settings'


function stubSelection(text: string, anchorNode: Node | null = document.body): void {
  vi.spyOn(window, 'getSelection').mockReturnValue({
    toString: () => text,
    rangeCount: text === '' ? 0 : 1,
    anchorNode,
    getRangeAt: () => ({
      // First line of the selection: the icon should anchor here.
      getClientRects: () => [{ top: 10, left: 20, bottom: 26, right: 300 } as DOMRect],
      getBoundingClientRect: () => ({ top: 10, left: 20, bottom: 90, right: 640 }) as DOMRect,
    }),
  } as unknown as Selection)
}

function iconButton(): HTMLButtonElement | null {
  return selectionIconButtonForTest()
}

async function selectAndSettle(): Promise<void> {
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  await vi.waitFor(() => {
    if (!selectionIconHostForTest()) throw new Error('icon not shown yet')
  })
}

installSelectionIcon()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isSelectionIconEnabled).mockResolvedValue(true)
  vi.stubGlobal('chrome', {
    runtime: { getURL: (path: string) => `chrome-extension://test-id/${path}` },
  })
})

afterEach(() => {
  hideSelectionIcon()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('selection icon', () => {
  it('appears after selecting non-empty text', async () => {
    stubSelection('hello world')
    await selectAndSettle()
    expect(selectionIconHostForTest()).not.toBeNull()
  })

  it('does not appear for a selection made inside our own bubble', async () => {
    // Selecting text inside the bubble raised the icon over it. A closed shadow tree reports
    // the selected text but reports no anchor node, so the anchor walk cannot see the
    // selection is ours; the release event's path still names the host.
    const bubbleHost = document.createElement('div')
    document.body.appendChild(bubbleHost)
    vi.mocked(currentBubbleHost).mockReturnValue(bubbleHost)
    stubSelection('kelime', null)

    const inner = document.createElement('span')
    bubbleHost.appendChild(inner)
    inner.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }))
    await new Promise((resolve) => setTimeout(resolve, 5))

    expect(selectionIconHostForTest()).toBeNull()

    vi.mocked(currentBubbleHost).mockReturnValue(null)
    bubbleHost.remove()
  })

  it('does not appear for a whitespace-only selection', async () => {
    stubSelection('   ')
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(selectionIconHostForTest()).toBeNull()
  })

  it('does not resurrect the icon that was hidden while the setting was still loading', async () => {
    let allow!: (enabled: boolean) => void
    vi.mocked(isSelectionIconEnabled).mockReturnValueOnce(
      new Promise((resolve) => { allow = resolve }),
    )

    stubSelection('hello world')
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 5))

    hideSelectionIcon() // Escape / scroll / selection cleared
    allow(true)
    await new Promise((resolve) => setTimeout(resolve, 5))

    expect(selectionIconHostForTest()).toBeNull()
  })

  it('does not appear when the setting is off', async () => {
    vi.mocked(isSelectionIconEnabled).mockResolvedValue(false)
    stubSelection('hello world')
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(selectionIconHostForTest()).toBeNull()
  })

  it('anchors to the start of the selection, not to the end of its bounding box', async () => {
    stubSelection('a paragraph spanning several lines')
    await selectAndSettle()

    const button = iconButton()!
    // Left edge of the first line, and below it because there is no room above.
    expect(button.style.left).toBe('20px')
    expect(button.style.top).toBe('32px')
  })

  it('never leaves two icons after repeated selections', async () => {
    stubSelection('first')
    await selectAndSettle()
    const first = selectionIconHostForTest()

    stubSelection('second')
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    // Wait for the icon to be *replaced*, not merely present: it already is.
    await vi.waitFor(() => {
      if (selectionIconHostForTest() === first) throw new Error('icon not replaced yet')
    })

    expect(first?.isConnected).toBe(false)
    expect(selectionIconHostForTest()?.isConnected).toBe(true)
  })

  it('shows the extension logo, not a text glyph', async () => {
    stubSelection('hello world')
    await selectAndSettle()

    const logo = iconButton()?.querySelector('img')
    expect(logo?.getAttribute('src')).toBe('chrome-extension://test-id/icons/icon48.png')
    expect(iconButton()?.textContent).toBe('')
  })

  it('opens the bubble with the selected text when clicked', async () => {
    stubSelection('hello world')
    await selectAndSettle()

    const button = iconButton()
    expect(button).not.toBeNull()
    const event = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(event, 'isTrusted', { value: true })
    button!.dispatchEvent(event)

    expect(openBubble).toHaveBeenCalledWith('hello world')
    expect(selectionIconHostForTest()).toBeNull()
  })

  it('hides once the selection is cleared', async () => {
    stubSelection('hello world')
    await selectAndSettle()

    stubSelection('')
    document.dispatchEvent(new Event('selectionchange'))
    expect(selectionIconHostForTest()).toBeNull()
  })

  it('hides on Escape and on scroll', async () => {
    stubSelection('hello world')
    await selectAndSettle()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(selectionIconHostForTest()).toBeNull()

    await selectAndSettle()
    window.dispatchEvent(new Event('scroll'))
    expect(selectionIconHostForTest()).toBeNull()
  })
})
