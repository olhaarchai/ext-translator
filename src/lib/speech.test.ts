import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasVoiceFor, speakToggle, speechAvailable, stopSpeaking } from './speech'
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

type FakeVoice = { lang: string; name?: string; voiceURI?: string; localService?: boolean; default?: boolean }

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

describe('hasVoiceFor', () => {
  it('is false when the API is missing', () => {
    expect(hasVoiceFor('en')).toBe(false)
  })

  it('optimistically true while no voices have loaded yet', () => {
    stubSpeech([])
    expect(hasVoiceFor('en')).toBe(true)
  })

  it('matches by base language, ignoring region', () => {
    stubSpeech([{ lang: 'en-US' }, { lang: 'de-DE' }])
    expect(hasVoiceFor('en')).toBe(true)
    expect(hasVoiceFor('en-GB')).toBe(true)
    expect(hasVoiceFor('uk')).toBe(false)
  })
})

describe('speakToggle', () => {
  beforeEach(() => stubSpeech([{ lang: 'en-US' }]))

  it('starts speaking the given text in the given language', () => {
    const synth = speechSynthesis as unknown as ReturnType<typeof stubSpeech>
    expect(speakToggle('hello', 'en')).toBe('started')
    expect(synth.speak).toHaveBeenCalledOnce()
    const utterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance
    expect(utterance.text).toBe('hello')
    expect(utterance.lang).toBe('en')
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

  it('prefers a higher-quality voice for the language', () => {
    const compact = { lang: 'en-US', name: 'Albert', localService: true, default: true }
    const enhanced = { lang: 'en-US', name: 'Samantha (Enhanced)', localService: true, default: false }
    const synth = stubSpeech([compact, enhanced])
    speakToggle('hello', 'en')
    const utterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance
    expect(utterance.voice).toBe(enhanced)
  })

  it('honors the stored voice preference over the score', () => {
    const enhanced = { lang: 'en-US', name: 'Samantha (Enhanced)', voiceURI: 'uri://s', localService: true }
    const plain = { lang: 'en-US', name: 'Albert', voiceURI: 'uri://a' }
    const synth = stubSpeech([enhanced, plain])
    vi.mocked(preferredVoiceURI).mockReturnValueOnce('uri://a')
    speakToggle('hello', 'en')
    const utterance = synth.speak.mock.calls[0]?.[0] as FakeUtterance
    expect(utterance.voice).toBe(plain)
  })

  it('does nothing without the API', () => {
    vi.unstubAllGlobals()
    expect(speakToggle('hello', 'en')).toBe('stopped')
  })
})
