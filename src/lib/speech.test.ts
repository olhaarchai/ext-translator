import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultVoiceFor,
  hasVoiceFor,
  speakToggle,
  speechAvailable,
  stopSpeaking,
  voicesForLanguage,
} from './speech'
import { preferredVoiceURI } from './voice-prefs'

vi.mock('./voice-prefs', () => ({
  preferredVoiceURI: vi.fn(() => undefined),
}))

class FakeUtterance {
  lang = ''
  voice: unknown = null
  onend: (() => void) | null = null
  constructor(public text: string) {}
}

type FakeVoice = {
  lang: string
  name?: string
  voiceURI?: string
  localService?: boolean
  default?: boolean
}

const LOCAL_EN: FakeVoice = { lang: 'en-US', name: 'Albert', voiceURI: 'uri://albert', localService: true }
const REMOTE_EN: FakeVoice = { lang: 'en-US', name: 'Google US English', voiceURI: 'uri://google-en', localService: false }

function stubSpeech(voices: FakeVoice[]) {
  const synth = {
    speaking: false,
    getVoices: vi.fn(() => voices),
    speak: vi.fn(function (this: void, u: FakeUtterance) {
      synth.speaking = true
      void u
    }),
    cancel: vi.fn(() => {
      synth.speaking = false
    }),
    addEventListener: vi.fn(),
  }
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  return synth
}

afterEach(() => {
  stopSpeaking()
  vi.unstubAllGlobals()
})

describe('speechAvailable', () => {
  it('is false without the Web Speech API', () => {
    expect(speechAvailable()).toBe(false)
  })

  it('is true when the API is present', () => {
    stubSpeech([])
    expect(speechAvailable()).toBe(true)
  })
})

describe('voicesForLanguage', () => {
  it('excludes network-backed voices, which would send the text off-device', () => {
    stubSpeech([LOCAL_EN, REMOTE_EN])
    expect(voicesForLanguage('en').map((v) => v.voiceURI)).toEqual(['uri://albert'])
  })

  it('matches by base language, ignoring region', () => {
    stubSpeech([LOCAL_EN, { lang: 'de-DE', name: 'Anna', localService: true }])
    expect(voicesForLanguage('en-GB')).toHaveLength(1)
    expect(voicesForLanguage('uk')).toHaveLength(0)
  })

  it('finds a Norwegian voice, which systems name by its written form', () => {
    // The model asks for 'no'; macOS installs 'nb-NO'. Compared as-is they never meet and
    // Norwegian looks voiceless while a voice is installed.
    stubSpeech([{ lang: 'nb-NO', name: 'Nora', voiceURI: 'uri://nora', localService: true }])
    expect(voicesForLanguage('no').map((v) => v.voiceURI)).toEqual(['uri://nora'])
  })

  it('does not confuse a language whose code merely starts alike', () => {
    stubSpeech([{ lang: 'nl-NL', name: 'Xander', localService: true }])
    expect(voicesForLanguage('no')).toHaveLength(0)
  })
})

describe('hasVoiceFor', () => {
  it('is false when the API is missing', () => {
    expect(hasVoiceFor('en')).toBe(false)
  })

  it('is false while no voices have loaded yet', () => {
    stubSpeech([])
    expect(hasVoiceFor('en')).toBe(false)
  })

  it('is false when only a network voice exists for the language', () => {
    stubSpeech([REMOTE_EN])
    expect(hasVoiceFor('en')).toBe(false)
  })

  it('is true when an on-device voice exists', () => {
    stubSpeech([LOCAL_EN])
    expect(hasVoiceFor('en')).toBe(true)
  })
})

describe('defaultVoiceFor', () => {
  it('prefers a higher-quality on-device voice', () => {
    const enhanced = { lang: 'en-US', name: 'Samantha (Enhanced)', localService: true }
    const plain = { lang: 'en-US', name: 'Albert', localService: true, default: true }
    stubSpeech([plain, enhanced])
    expect(defaultVoiceFor('en')).toBe(enhanced)
  })

  it('never returns a network voice, even if it scores higher by name', () => {
    const remoteFancy = { lang: 'en-US', name: 'Google Neural Premium', localService: false }
    stubSpeech([LOCAL_EN, remoteFancy])
    expect(defaultVoiceFor('en')).toBe(LOCAL_EN)
  })

  it('is null when no on-device voice exists', () => {
    stubSpeech([REMOTE_EN])
    expect(defaultVoiceFor('en')).toBeNull()
  })
})

describe('speakToggle', () => {
  beforeEach(() => stubSpeech([LOCAL_EN]))

  it('speaks the given text with an explicit on-device voice', () => {
    const synth = speechSynthesis as unknown as ReturnType<typeof stubSpeech>
    expect(speakToggle('hello', 'en')).toBe('started')
    const utterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance
    expect(utterance.text).toBe('hello')
    expect(utterance.lang).toBe('en')
    expect(utterance.voice).toBe(LOCAL_EN)
  })

  it('refuses to speak when only a network voice exists, rather than letting the browser pick it', () => {
    const synth = stubSpeech([REMOTE_EN])
    expect(speakToggle('hello', 'en')).toBe('stopped')
    expect(synth.speak).not.toHaveBeenCalled()
  })

  it('refuses to speak when no voice matches the language at all', () => {
    const synth = stubSpeech([LOCAL_EN])
    expect(speakToggle('привіт', 'uk')).toBe('stopped')
    expect(synth.speak).not.toHaveBeenCalled()
  })

  it('toggles off when the same text is activated while speaking', () => {
    speakToggle('hello', 'en')
    expect(speakToggle('hello', 'en')).toBe('stopped')
  })

  it('switching to a different text cancels the previous and starts anew', () => {
    const synth = speechSynthesis as unknown as ReturnType<typeof stubSpeech>
    speakToggle('hello', 'en')
    expect(speakToggle('world', 'en')).toBe('started')
    expect(synth.cancel).toHaveBeenCalled()
    expect(synth.speak).toHaveBeenCalledTimes(2)
  })

  it('honors the stored voice preference over the score', () => {
    const enhanced = { lang: 'en-US', name: 'Samantha (Enhanced)', voiceURI: 'uri://s', localService: true }
    const synth = stubSpeech([enhanced, LOCAL_EN])
    vi.mocked(preferredVoiceURI).mockReturnValueOnce('uri://albert')
    speakToggle('hello', 'en')
    const utterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance
    expect(utterance.voice).toBe(LOCAL_EN)
  })

  it('ignores a stored preference that points at a network voice', () => {
    const synth = stubSpeech([LOCAL_EN, REMOTE_EN])
    vi.mocked(preferredVoiceURI).mockReturnValueOnce('uri://google-en')
    speakToggle('hello', 'en')
    const utterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance
    expect(utterance.voice).toBe(LOCAL_EN)
  })

  it('does nothing without the API', () => {
    vi.unstubAllGlobals()
    expect(speakToggle('hello', 'en')).toBe('stopped')
  })
})
