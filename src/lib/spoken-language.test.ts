// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const speakToggle = vi.fn()
let available = true
let voiceLanguages: string[] = ['en', 'tr']

vi.mock('./speech', () => ({
  speechAvailable: () => available,
  hasVoiceFor: (lang: string) => voiceLanguages.includes(lang),
  speakToggle: (text: string, lang: string) => speakToggle(text, lang),
}))

import { spokenLanguage } from './spoken-language'

/** The control refuses untrusted events, so a test click has to look like a real one. */
function userClick(target: HTMLElement): void {
  const event = new MouseEvent('click', { bubbles: true })
  Object.defineProperty(event, 'isTrusted', { value: true })
  target.dispatchEvent(event)
}

beforeEach(() => {
  speakToggle.mockClear()
  available = true
  voiceLanguages = ['en', 'tr']
})

function speakerOf(group: HTMLElement): HTMLButtonElement {
  return group.querySelector('.speak') as HTMLButtonElement
}

describe('spokenLanguage', () => {
  it('shows the language name next to the control that speaks it', () => {
    const group = spokenLanguage('merhaba', 'tr', 'meta')
    expect(group.querySelector('.meta')?.textContent).toBe('Turkish')
    expect(speakerOf(group)).not.toBeNull()
  })

  it('keeps each group bound to its own text and language', () => {
    // The whole point of pairing them: the source control must never read the translation.
    const source = spokenLanguage('hello', 'en', 'meta')
    const target = spokenLanguage('merhaba', 'tr', 'meta')

    userClick(speakerOf(source))
    expect(speakToggle).toHaveBeenLastCalledWith('hello', 'en')

    userClick(speakerOf(target))
    expect(speakToggle).toHaveBeenLastCalledWith('merhaba', 'tr')
  })

  it('still names the language when no voice can speak it', () => {
    voiceLanguages = []
    const group = spokenLanguage('merhaba', 'tr', 'meta')

    expect(group.querySelector('.meta')?.textContent).toBe('Turkish')
    expect(speakerOf(group).disabled).toBe(true)
  })

  it('names the language even where no control exists at all', () => {
    available = false
    const group = spokenLanguage('merhaba', 'tr', 'meta')

    expect(group.querySelector('.meta')?.textContent).toBe('Turkish')
    expect(group.querySelector('.speak')).toBeNull()
  })
})
