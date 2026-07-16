// Not an API limit: the browser documents none. This is a guard against a page-sized
// selection, because translations run sequentially and one huge job blocks every later one.
export const MAX_CHARS = 50_000

export type TranslateProgress =
  | { kind: 'detecting' }
  | { kind: 'downloading'; progress: number }
  | { kind: 'translating' }

export type TranslateError =
  | 'unsupported-browser'
  | 'detection-failed'
  | 'pair-unavailable'
  | 'download-failed'
  | 'needs-activation'
  | 'translation-failed'

export type TranslateOutcome =
  | { kind: 'result'; translation: string; sourceLanguage: string; truncated: boolean }
  | { kind: 'same-language'; language: string }
  | { kind: 'aborted' }
  | { kind: 'error'; error: TranslateError; sourceLanguage?: string }

export async function translateSelection(
  rawText: string,
  targetLanguage: string,
  onProgress: (progress: TranslateProgress) => void,
  onPartial?: (translation: string) => void,
  signal?: AbortSignal,
): Promise<TranslateOutcome> {
  if (!('Translator' in globalThis) || !('LanguageDetector' in globalThis)) {
    return { kind: 'error', error: 'unsupported-browser' }
  }

  const truncated = rawText.length > MAX_CHARS
  const text = truncated ? rawText.slice(0, MAX_CHARS) : rawText

  onProgress({ kind: 'detecting' })
  let candidates: string[]
  try {
    const detector = await LanguageDetector.create()
    try {
      const detected = await detector.detect(text)
      candidates = detected
        .map((candidate) => candidate.detectedLanguage)
        .filter((lang) => lang !== '' && lang !== 'und')
    } finally {
      detector.destroy()
    }
  } catch (error) {
    return { kind: 'error', error: mapCreateError(error, 'detection-failed') }
  }

  const primary = candidates[0]
  if (primary === undefined) {
    return { kind: 'error', error: 'detection-failed' }
  }
  if (primary === targetLanguage) {
    return { kind: 'same-language', language: targetLanguage }
  }

  const sourceLanguage = await firstAvailableSource(candidates, targetLanguage)
  if (sourceLanguage === null) {
    return { kind: 'error', error: 'pair-unavailable', sourceLanguage: primary }
  }

  let translator: Translator
  try {
    translator = await Translator.create({
      sourceLanguage,
      targetLanguage,
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          onProgress({ kind: 'downloading', progress: event.loaded })
        })
      },
    })
  } catch (error) {
    return { kind: 'error', error: mapCreateError(error, 'download-failed'), sourceLanguage }
  }

  try {
    onProgress({ kind: 'translating' })
    let translation = ''
    for await (const chunk of translator.translateStreaming(text)) {
      if (signal?.aborted) return { kind: 'aborted' }
      translation = mergeChunk(translation, chunk)
      onPartial?.(translation)
    }
    if (signal?.aborted) return { kind: 'aborted' }
    return { kind: 'result', translation, sourceLanguage, truncated }
  } catch {
    if (signal?.aborted) return { kind: 'aborted' }
    return { kind: 'error', error: 'translation-failed', sourceLanguage }
  } finally {
    translator.destroy()
  }
}

/**
 * The streaming call is documented for long text but not on whether a chunk carries only
 * the new piece or everything so far, so handle both: a chunk that extends what we have
 * replaces it, anything else is appended.
 */
function mergeChunk(soFar: string, chunk: string): string {
  if (soFar !== '' && chunk.length > soFar.length && chunk.startsWith(soFar)) return chunk
  return soFar + chunk
}

const MAX_CANDIDATES = 5

async function firstAvailableSource(candidates: string[], target: string): Promise<string | null> {
  const seen = new Set<string>()
  for (const lang of candidates.slice(0, MAX_CANDIDATES)) {
    if (lang === target || seen.has(lang)) continue
    seen.add(lang)
    try {
      const availability = await Translator.availability({ sourceLanguage: lang, targetLanguage: target })
      if (availability !== 'unavailable') return lang
    } catch {
      // Treat a failed availability probe as unavailable and try the next candidate.
    }
  }
  return null
}

function mapCreateError(error: unknown, fallback: TranslateError): TranslateError {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'needs-activation'
  }
  return fallback
}
