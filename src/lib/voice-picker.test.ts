// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

let speechOn = true

vi.mock('./speech', () => ({
  speechAvailable: () => speechOn,
  voicesForLanguage: vi.fn(),
  defaultVoiceFor: vi.fn(() => null),
}))

vi.mock('./voice-prefs', () => ({
  preferredVoiceURI: vi.fn(() => undefined),
  setPreferredVoice: vi.fn(async () => {}),
}))

import { defaultVoiceFor, voicesForLanguage } from './speech'
import { voiceControl } from './voice-picker'
import { preferredVoiceURI, setPreferredVoice } from './voice-prefs'

const VOICES = [
  { voiceURI: 'uri://albert', name: 'Albert' },
  { voiceURI: 'uri://samantha', name: 'Samantha (Enhanced)' },
] as unknown as SpeechSynthesisVoice[]

function selectOf(control: HTMLElement | null): HTMLSelectElement {
  return control!.querySelector('select') as HTMLSelectElement
}

afterEach(() => {
  vi.clearAllMocks()
  speechOn = true
})

describe('voiceControl', () => {
  it('is absent only when the browser cannot speak at all', () => {
    speechOn = false
    vi.mocked(voicesForLanguage).mockReturnValue(VOICES)
    expect(voiceControl('en')).toBeNull()
  })

  it('lists all voices and marks the stored preference selected', () => {
    vi.mocked(voicesForLanguage).mockReturnValue(VOICES)
    vi.mocked(preferredVoiceURI).mockReturnValue('uri://samantha')

    const select = selectOf(voiceControl('en'))
    expect(select.options).toHaveLength(2)
    expect(select.value).toBe('uri://samantha')
  })

  it('falls back to the best-scoring voice, not the first one, when nothing is stored', () => {
    vi.mocked(voicesForLanguage).mockReturnValue(VOICES)
    vi.mocked(preferredVoiceURI).mockReturnValue(undefined)
    vi.mocked(defaultVoiceFor).mockReturnValue(VOICES[1]!)

    const select = selectOf(voiceControl('en'))
    expect(select.value).toBe('uri://samantha')
  })

  it('persists the choice on change', () => {
    vi.mocked(voicesForLanguage).mockReturnValue(VOICES)
    const select = selectOf(voiceControl('en'))

    select.value = 'uri://albert'
    select.dispatchEvent(new Event('change'))

    expect(setPreferredVoice).toHaveBeenCalledWith('en', 'uri://albert')
  })

  it('still shows the control with a single voice, so nothing looks broken', () => {
    // Her point: a control that disappears reads as a fault, not as "there is one voice".
    vi.mocked(voicesForLanguage).mockReturnValue([VOICES[0]!])
    const control = voiceControl('en')!

    expect(control.querySelector('.voice-caret')?.textContent).toBe('▾')
    expect(selectOf(control).options).toHaveLength(1)
  })

  it('stays compact — a caret, not the voice name on screen — and names its language', () => {
    vi.mocked(voicesForLanguage).mockReturnValue(VOICES)
    const control = voiceControl('en')!

    expect(control.querySelector('.voice-caret')?.textContent).toBe('▾')
    expect(selectOf(control).className).toContain('voice-select')
    expect(selectOf(control).getAttribute('aria-label')).toBe('Voice for English')
  })

  it('explains where the voice comes from, on hover', () => {
    vi.mocked(voicesForLanguage).mockReturnValue(VOICES)
    const title = voiceControl('en')!.title
    expect(title).toContain('on-device')
    expect(title).toContain('nothing is sent to a server')
  })

  it('shows a visible badge, not an empty gap, when the system has no voice', () => {
    vi.mocked(voicesForLanguage).mockReturnValue([])
    const badge = voiceControl('tr')!

    expect(badge.className).toContain('voice-none')
    expect(badge.textContent).toBe('No system voice')
    expect(badge.title).toContain('Turkish')
    expect(badge.title).toContain('speech settings')
  })
})
