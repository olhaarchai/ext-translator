// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./bubble', () => ({
  openBubble: vi.fn(async () => {}),
}))

vi.mock('./settings', () => ({
  isSelectionIconEnabled: vi.fn(async () => true),
}))

import { openBubble } from './bubble'
import {
  hideSelectionIcon,
  installSelectionIcon,
  selectionIconButtonForTest,
  selectionIconHostForTest,
} from './selection-icon'
import { isSelectionIconEnabled } from './settings'

const HOST_ID = 'ext-translator-selection-icon'

function stubSelection(text: string, anchorNode: Node = document.body): void {
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
})

afterEach(() => {
  hideSelectionIcon()
  vi.restoreAllMocks()
})

describe('selection icon', () => {
  it('appears after selecting non-empty text', async () => {
    stubSelection('hello world')
    await selectAndSettle()
    expect(document.getElementById(HOST_ID)).not.toBeNull()
  })

  it('does not appear for a whitespace-only selection', async () => {
    stubSelection('   ')
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(document.getElementById(HOST_ID)).toBeNull()
  })

  it('does not appear when the setting is off', async () => {
    vi.mocked(isSelectionIconEnabled).mockResolvedValue(false)
    stubSelection('hello world')
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(document.getElementById(HOST_ID)).toBeNull()
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
    stubSelection('second')
    await selectAndSettle()
    expect(document.querySelectorAll(`#${HOST_ID}`)).toHaveLength(1)
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
    expect(document.getElementById(HOST_ID)).toBeNull()
  })

  it('hides once the selection is cleared', async () => {
    stubSelection('hello world')
    await selectAndSettle()

    stubSelection('')
    document.dispatchEvent(new Event('selectionchange'))
    expect(document.getElementById(HOST_ID)).toBeNull()
  })

  it('hides on Escape and on scroll', async () => {
    stubSelection('hello world')
    await selectAndSettle()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.getElementById(HOST_ID)).toBeNull()

    await selectAndSettle()
    window.dispatchEvent(new Event('scroll'))
    expect(document.getElementById(HOST_ID)).toBeNull()
  })
})
