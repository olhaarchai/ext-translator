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
    translateSelection: vi.fn(),
  }
})

vi.mock('./vocab-client', () => ({
  vocabHas: vi.fn(async () => false),
  vocabAdd: vi.fn(async () => 'added'),
  vocabRemove: vi.fn(async () => {}),
}))

vi.mock('./speech', () => ({
  speechAvailable: () => true,
  hasVoiceFor: () => true,
  speakToggle: vi.fn(),
  onVoicesChanged: () => {},
  stopSpeaking: vi.fn(),
  voicesForLanguage: () => [],
}))

import { bubbleRootForTest, closeBubble, openBubble } from './bubble'
import { grantConsent, hasConsent } from './settings'
import { speakToggle, stopSpeaking } from './speech'
import { translateSelection } from './translate'
import { vocabAdd, vocabHas, vocabRemove } from './vocab-client'

const HOST_ID = 'ext-translator-host'

const RESULT = { kind: 'result', translation: 'Привіт', sourceLanguage: 'en', truncated: false } as const

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
  vi.mocked(hasConsent).mockResolvedValue(true)
  vi.mocked(vocabHas).mockResolvedValue(false)
  vi.mocked(vocabAdd).mockResolvedValue('added')
  vi.mocked(translateSelection).mockResolvedValue(RESULT)
})

afterEach(() => {
  closeBubble()
})

describe('bubble translation', () => {
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

describe('bubble save-to-vocabulary', () => {
  async function saveButton(): Promise<HTMLElement> {
    let node: HTMLElement | null = null
    await vi.waitFor(() => {
      node = root().querySelector('.save button')
      if (!node) throw new Error('save control not ready')
    })
    return node as unknown as HTMLElement
  }

  it('saves the shown translation, sending the full entry', async () => {
    await openBubble('hello world')
    trustedClick(await saveButton())

    await vi.waitFor(() => {
      expect(vocabAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceText: 'hello world',
          translation: 'Привіт',
          sourceLanguage: 'en',
          targetLanguage: 'uk',
        }),
      )
      expect(root().querySelector('.save button')?.textContent).toContain('Saved')
    })
  })

  it('shows the saved state immediately when the entry already exists', async () => {
    vi.mocked(vocabHas).mockResolvedValue(true)
    await openBubble('hello world')
    expect((await saveButton()).textContent).toContain('Saved')
    expect(vocabAdd).not.toHaveBeenCalled()
  })

  it('removes the entry from the saved state', async () => {
    vi.mocked(vocabHas).mockResolvedValue(true)
    await openBubble('hello world')
    trustedClick(await saveButton())
    await vi.waitFor(() => {
      expect(vocabRemove).toHaveBeenCalledWith(
        expect.objectContaining({ sourceText: 'hello world', sourceLanguage: 'en', targetLanguage: 'uk' }),
      )
      expect(root().querySelector('.save button')?.textContent).toBe('Save to vocabulary')
    })
  })

  it('offers no save control when the text is already in the target language', async () => {
    vi.mocked(translateSelection).mockResolvedValueOnce({ kind: 'same-language', language: 'uk' })
    await openBubble('привіт')
    await vi.waitFor(() => {
      expect(root().querySelector('.message')?.textContent).toContain('already in')
    })
    expect(root().querySelector('.save')).toBeNull()
  })

  it('offers no save control on an error outcome', async () => {
    vi.mocked(translateSelection).mockResolvedValueOnce({ kind: 'error', error: 'translation-failed', sourceLanguage: 'en' })
    await openBubble('hello world')
    await vi.waitFor(() => {
      expect(root().querySelector('.message')).not.toBeNull()
    })
    expect(root().querySelector('.save')).toBeNull()
  })
})

describe('bubble streaming', () => {
  it('shows the translation growing, with no save control until it completes', async () => {
    const snapshots: Array<{ text: string | null; hasSave: boolean }> = []
    const snapshot = () => {
      snapshots.push({
        text: root().querySelector('.translation')?.textContent ?? null,
        hasSave: root().querySelector('.save') !== null,
      })
    }

    vi.mocked(translateSelection).mockImplementation(async (_text, _target, _onProgress, onPartial) => {
      onPartial?.('При')
      snapshot()
      onPartial?.('Привіт')
      snapshot()
      return RESULT
    })

    await openBubble('hello world')

    expect(snapshots).toEqual([
      { text: 'При', hasSave: false },
      { text: 'Привіт', hasSave: false },
    ])
    await vi.waitFor(() => {
      expect(root().querySelector('.save')).not.toBeNull()
    })
  })

  it('aborts the running translation when the bubble closes', async () => {
    let captured: AbortSignal | undefined
    vi.mocked(translateSelection).mockImplementation(async (_text, _target, _onProgress, _onPartial, signal) => {
      captured = signal
      return RESULT
    })

    await openBubble('hello world')
    expect(captured?.aborted).toBe(false)

    closeBubble()
    expect(captured?.aborted).toBe(true)
  })

  it('leaves the screen untouched when a run reports it was aborted', async () => {
    vi.mocked(translateSelection).mockResolvedValueOnce({ kind: 'aborted' })
    await openBubble('hello world')
    expect(root().querySelector('.translation')).toBeNull()
  })
})

describe('bubble pronunciation', () => {
  it('speaks the original text in the detected source language', async () => {
    await openBubble('hello world')
    await vi.waitFor(() => expect(root().querySelector('.speak')).not.toBeNull())

    const speaker = root().querySelector('.speak') as HTMLButtonElement
    const event = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(event, 'isTrusted', { value: true })
    speaker.dispatchEvent(event)

    expect(speakToggle).toHaveBeenCalledWith('hello world', 'en')
  })

  it('stops playback when the bubble is closed', async () => {
    await openBubble('hello world')
    vi.mocked(stopSpeaking).mockClear()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(stopSpeaking).toHaveBeenCalled()
    expect(document.getElementById(HOST_ID)).toBeNull()
  })
})
