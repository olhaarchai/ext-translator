export const MAX_CHARS = 4000

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
  | { kind: 'error'; error: TranslateError; sourceLanguage?: string }

export async function translateSelection(
  rawText: string,
  targetLanguage: string,
  onProgress: (progress: TranslateProgress) => void,
): Promise<TranslateOutcome> {
  if (!('Translator' in globalThis) || !('LanguageDetector' in globalThis)) {
    return { kind: 'error', error: 'unsupported-browser' }
  }

  const truncated = rawText.length > MAX_CHARS
  const text = truncated ? rawText.slice(0, MAX_CHARS) : rawText

  onProgress({ kind: 'detecting' })
  let sourceLanguage: string
  try {
    const detector = await LanguageDetector.create()
    try {
      const candidates = await detector.detect(text)
      const top = candidates[0]
      if (!top || top.detectedLanguage === '' || top.detectedLanguage === 'und') {
        return { kind: 'error', error: 'detection-failed' }
      }
      sourceLanguage = top.detectedLanguage
    } finally {
      detector.destroy()
    }
  } catch (error) {
    return { kind: 'error', error: mapCreateError(error, 'detection-failed') }
  }

  if (sourceLanguage === targetLanguage) {
    return { kind: 'same-language', language: targetLanguage }
  }

  try {
    const availability = await Translator.availability({ sourceLanguage, targetLanguage })
    if (availability === 'unavailable') {
      return { kind: 'error', error: 'pair-unavailable', sourceLanguage }
    }
  } catch {
    return { kind: 'error', error: 'pair-unavailable', sourceLanguage }
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
    const translation = await translator.translate(text)
    return { kind: 'result', translation, sourceLanguage, truncated }
  } catch {
    return { kind: 'error', error: 'translation-failed', sourceLanguage }
  } finally {
    translator.destroy()
  }
}

function mapCreateError(error: unknown, fallback: TranslateError): TranslateError {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'needs-activation'
  }
  return fallback
}
