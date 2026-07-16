// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./speech', () => ({
  voicesForLanguage: vi.fn(),
}))

vi.mock('./voice-prefs', () => ({
  preferredVoiceURI: vi.fn(() => undefined),
  setPreferredVoice: vi.fn(async () => {}),
}))

import { voicesForLanguage } from './speech'
import { voicePicker } from './voice-picker'
import { preferredVoiceURI, setPreferredVoice } from './voice-prefs'

const VOICES = [
  { voiceURI: 'uri://albert', name: 'Albert' },
  { voiceURI: 'uri://samantha', name: 'Samantha (Enhanced)' },
] as unknown as SpeechSynthesisVoice[]

afterEach(() => {
  vi.clearAllMocks()
})

describe('voicePicker', () => {
  it('returns null when fewer than two voices exist', () => {
    vi.mocked(voicesForLanguage).mockReturnValue([VOICES[0]!])
    expect(voicePicker('en')).toBeNull()
  })

  it('lists all voices and marks the stored preference selected', () => {
    vi.mocked(voicesForLanguage).mockReturnValue(VOICES)
    vi.mocked(preferredVoiceURI).mockReturnValue('uri://samantha')

    const select = voicePicker('en')!
    expect(select.options).toHaveLength(2)
    expect(select.value).toBe('uri://samantha')
  })

  it('persists the choice on change', () => {
    vi.mocked(voicesForLanguage).mockReturnValue(VOICES)
    const select = voicePicker('en')!

    select.value = 'uri://albert'
    select.dispatchEvent(new Event('change'))

    expect(setPreferredVoice).toHaveBeenCalledWith('en', 'uri://albert')
  })
})
