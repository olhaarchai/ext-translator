// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const speakToggle = vi.fn()
let available = true
let voiceLanguages: string[] = ['en']

vi.mock('./speech', () => ({
  speechAvailable: () => available,
  hasVoiceFor: (lang: string) => voiceLanguages.includes(lang),
  speakToggle: (text: string, lang: string) => speakToggle(text, lang),
}))

import { speakerButton } from './speaker-button'

/** The control refuses untrusted events, so a test click has to look like a real one. */
function userClick(target: HTMLElement): void {
  const event = new MouseEvent('click', { bubbles: true })
  Object.defineProperty(event, 'isTrusted', { value: true })
  target.dispatchEvent(event)
}

beforeEach(() => {
  speakToggle.mockClear()
  available = true
  voiceLanguages = ['en']
})

describe('speakerButton', () => {
  it('speaks its own text in its own language', () => {
    const button = speakerButton('hello', 'en')!
    userClick(button)
    expect(speakToggle).toHaveBeenCalledWith('hello', 'en')
  })

  it('names the language it speaks, so two controls side by side are distinguishable', () => {
    const button = speakerButton('hello', 'en')!
    expect(button.getAttribute('aria-label')).toBe('Listen in English')
  })

  it('tells the reader how to get a missing voice instead of only that it is missing', () => {
    // Systems ship voices for the interface language and little else, so this is the
    // common case for a target language. "Not available" alone reads as a broken
    // extension and leaves the reader with nothing to do.
    const button = speakerButton('merhaba', 'tr')!

    expect(button.disabled).toBe(true)
    const label = button.getAttribute('aria-label') ?? ''
    expect(label).toContain('Turkish')
    expect(label).toContain('system')
    expect(button.title).toBe(label)
  })

  it('stays silent when it has no voice, however it is activated', () => {
    const button = speakerButton('merhaba', 'tr')!
    userClick(button)
    expect(speakToggle).not.toHaveBeenCalled()
  })

  it('ignores a click the user did not make', () => {
    const button = speakerButton('hello', 'en')!
    button.click()
    expect(speakToggle).not.toHaveBeenCalled()
  })

  it('is absent entirely when the browser cannot speak at all', () => {
    available = false
    expect(speakerButton('hello', 'en')).toBeNull()
  })
})
