import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_CHARS, translateSelection, type TranslateProgress } from './translate'

function stubLanguageDetector(candidates: LanguageDetectionResult[]) {
  const destroy = vi.fn()
  const detect = vi.fn(async () => candidates)
  vi.stubGlobal('LanguageDetector', {
    create: vi.fn(async () => ({ detect, destroy })),
  })
  return { detect, destroy }
}

function stubTranslator(options: {
  availability?: AIAvailability | ((sourceLanguage: string) => AIAvailability)
  createError?: unknown
  downloadEvents?: number[]
  translateError?: unknown
} = {}) {
  const destroy = vi.fn()
  const translate = vi.fn(async (text: string) => {
    if (options.translateError) throw options.translateError
    return `[[${text}]]`
  })
  const create = vi.fn(async (createOptions: TranslatorCreateOptions) => {
    if (options.createError) throw options.createError
    if (options.downloadEvents && createOptions.monitor) {
      const target = new EventTarget()
      createOptions.monitor(target as AICreateMonitor)
      for (const loaded of options.downloadEvents) {
        target.dispatchEvent(Object.assign(new Event('downloadprogress'), { loaded }))
      }
    }
    return { translate, destroy }
  })
  vi.stubGlobal('Translator', {
    availability: vi.fn(async (probe: { sourceLanguage: string }) => {
      const availability = options.availability
      if (typeof availability === 'function') return availability(probe.sourceLanguage)
      return availability ?? 'available'
    }),
    create,
  })
  return { create, translate, destroy }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('translateSelection', () => {
  it('reports unsupported browser when the APIs are missing', async () => {
    const outcome = await translateSelection('hello', 'uk', () => {})
    expect(outcome).toEqual({ kind: 'error', error: 'unsupported-browser' })
  })

  it('translates and reports detected source language', async () => {
    stubLanguageDetector([{ detectedLanguage: 'en', confidence: 0.9 }])
    stubTranslator()
    const outcome = await translateSelection('hello', 'uk', () => {})
    expect(outcome).toEqual({
      kind: 'result',
      translation: '[[hello]]',
      sourceLanguage: 'en',
      truncated: false,
    })
  })

  it('fails clearly when detection yields nothing usable', async () => {
    stubLanguageDetector([])
    stubTranslator()
    const outcome = await translateSelection('hello', 'uk', () => {})
    expect(outcome).toEqual({ kind: 'error', error: 'detection-failed' })
  })

  it('treats "und" as failed detection', async () => {
    stubLanguageDetector([{ detectedLanguage: 'und', confidence: 0.1 }])
    stubTranslator()
    const outcome = await translateSelection('hello', 'uk', () => {})
    expect(outcome).toEqual({ kind: 'error', error: 'detection-failed' })
  })

  it('skips translating when source equals target', async () => {
    stubLanguageDetector([{ detectedLanguage: 'uk', confidence: 0.9 }])
    const { create } = stubTranslator()
    const outcome = await translateSelection('привіт', 'uk', () => {})
    expect(outcome).toEqual({ kind: 'same-language', language: 'uk' })
    expect(create).not.toHaveBeenCalled()
  })

  it('reports an unavailable language pair', async () => {
    stubLanguageDetector([{ detectedLanguage: 'en', confidence: 0.9 }])
    stubTranslator({ availability: 'unavailable' })
    const outcome = await translateSelection('hello', 'uk', () => {})
    expect(outcome).toEqual({ kind: 'error', error: 'pair-unavailable', sourceLanguage: 'en' })
  })

  it('falls back to the next candidate when the top language pair is unavailable', async () => {
    stubLanguageDetector([
      { detectedLanguage: 'la', confidence: 0.6 },
      { detectedLanguage: 'en', confidence: 0.3 },
    ])
    stubTranslator({ availability: (lang) => (lang === 'en' ? 'available' : 'unavailable') })
    const outcome = await translateSelection('Senatus', 'uk', () => {})
    expect(outcome).toEqual({ kind: 'result', translation: '[[Senatus]]', sourceLanguage: 'en', truncated: false })
  })

  it('reports the top candidate when no candidate pair is available', async () => {
    stubLanguageDetector([
      { detectedLanguage: 'la', confidence: 0.6 },
      { detectedLanguage: 'en', confidence: 0.3 },
    ])
    stubTranslator({ availability: 'unavailable' })
    const outcome = await translateSelection('Senatus', 'uk', () => {})
    expect(outcome).toEqual({ kind: 'error', error: 'pair-unavailable', sourceLanguage: 'la' })
  })

  it('surfaces download progress events', async () => {
    stubLanguageDetector([{ detectedLanguage: 'en', confidence: 0.9 }])
    stubTranslator({ downloadEvents: [0.25, 1] })
    const progress: TranslateProgress[] = []
    const outcome = await translateSelection('hello', 'uk', (p) => progress.push(p))
    expect(outcome.kind).toBe('result')
    expect(progress).toContainEqual({ kind: 'downloading', progress: 0.25 })
    expect(progress).toContainEqual({ kind: 'downloading', progress: 1 })
  })

  it('maps a blocked user gesture to needs-activation', async () => {
    stubLanguageDetector([{ detectedLanguage: 'en', confidence: 0.9 }])
    stubTranslator({ createError: new DOMException('gesture', 'NotAllowedError') })
    const outcome = await translateSelection('hello', 'uk', () => {})
    expect(outcome).toEqual({ kind: 'error', error: 'needs-activation', sourceLanguage: 'en' })
  })

  it('maps other create failures to download-failed', async () => {
    stubLanguageDetector([{ detectedLanguage: 'en', confidence: 0.9 }])
    stubTranslator({ createError: new Error('network') })
    const outcome = await translateSelection('hello', 'uk', () => {})
    expect(outcome).toEqual({ kind: 'error', error: 'download-failed', sourceLanguage: 'en' })
  })

  it('truncates long selections and flags it', async () => {
    stubLanguageDetector([{ detectedLanguage: 'en', confidence: 0.9 }])
    const { translate } = stubTranslator()
    const long = 'a'.repeat(MAX_CHARS + 100)
    const outcome = await translateSelection(long, 'uk', () => {})
    expect(outcome.kind).toBe('result')
    if (outcome.kind === 'result') {
      expect(outcome.truncated).toBe(true)
    }
    expect(translate).toHaveBeenCalledWith('a'.repeat(MAX_CHARS))
  })

  it('reports translation failure and still destroys the translator', async () => {
    stubLanguageDetector([{ detectedLanguage: 'en', confidence: 0.9 }])
    const { destroy } = stubTranslator({ translateError: new Error('boom') })
    const outcome = await translateSelection('hello', 'uk', () => {})
    expect(outcome).toEqual({ kind: 'error', error: 'translation-failed', sourceLanguage: 'en' })
    expect(destroy).toHaveBeenCalled()
  })
})
