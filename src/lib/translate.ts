import { withWatchdog } from './watchdog'

// Not an API limit: the browser documents none. This is a guard against a page-sized
// selection, because translations run sequentially and one huge job blocks every later one.
export const MAX_CHARS = 50_000

// Availability probes never download anything; in a healthy browser they answer fast.
const PROBE_TIMEOUT_MS = 3000
// create() may legitimately download a model; download progress resets this timer, so it
// only fires after sustained silence.
const CREATE_TIMEOUT_MS = 8000

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

export function hasBuiltinTranslation(): boolean {
  return 'Translator' in globalThis && 'LanguageDetector' in globalThis
}

export async function translateSelection(
  rawText: string,
  targetLanguage: string,
  onProgress: (progress: TranslateProgress) => void,
  onPartial?: (translation: string) => void,
  signal?: AbortSignal,
): Promise<TranslateOutcome> {
  if (!hasBuiltinTranslation()) {
    return { kind: 'error', error: 'unsupported-browser' }
  }

  const truncated = rawText.length > MAX_CHARS
  const text = truncated ? rawText.slice(0, MAX_CHARS) : rawText

  onProgress({ kind: 'detecting' })

  // Chromium forks expose these classes without the download service behind them, so
  // presence alone proves nothing: probe availability, and treat a create() that hangs
  // with no download activity as an unsupported browser (the caller then falls back to
  // the offline engine).
  if (typeof LanguageDetector.availability === 'function') {
    try {
      const availability = await withWatchdog(() => LanguageDetector.availability(), PROBE_TIMEOUT_MS, signal)
      if (availability === 'timed-out' || availability === 'unavailable') {
        return { kind: 'error', error: 'unsupported-browser' }
      }
    } catch {
      if (signal?.aborted) return { kind: 'aborted' }
      return { kind: 'error', error: 'unsupported-browser' }
    }
  }

  let candidates: string[]
  try {
    const created = await withWatchdog(
      (watchdogSignal, alive) =>
        LanguageDetector.create({
          signal: watchdogSignal,
          monitor(monitor) {
            monitor.addEventListener('downloadprogress', alive)
          },
        }),
      CREATE_TIMEOUT_MS,
      signal,
    )
    if (created === 'timed-out') return { kind: 'error', error: 'unsupported-browser' }
    try {
      const detected = await created.detect(text)
      candidates = detected
        .map((candidate) => candidate.detectedLanguage)
        .filter((lang) => lang !== '' && lang !== 'und')
    } finally {
      created.destroy()
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
  if (sourceLanguage === 'timed-out') {
    return { kind: 'error', error: 'unsupported-browser' }
  }
  if (sourceLanguage === null) {
    return { kind: 'error', error: 'pair-unavailable', sourceLanguage: primary }
  }

  let translator: Translator
  try {
    const created = await withWatchdog(
      (watchdogSignal, alive) =>
        Translator.create({
          sourceLanguage,
          targetLanguage,
          signal: watchdogSignal,
          monitor(monitor) {
            monitor.addEventListener('downloadprogress', (event) => {
              alive()
              onProgress({ kind: 'downloading', progress: event.loaded })
            })
          },
        }),
      CREATE_TIMEOUT_MS,
      signal,
    )
    if (created === 'timed-out') return { kind: 'error', error: 'unsupported-browser' }
    translator = created
  } catch (error) {
    return { kind: 'error', error: mapCreateError(error, 'download-failed'), sourceLanguage }
  }

  try {
    onProgress({ kind: 'translating' })
    let translation = ''
    // Each chunk is only the newly produced text, never the translation so far: the
    // conformance tests concatenate chunks and assert the exact full result.
    for await (const chunk of translator.translateStreaming(text)) {
      if (signal?.aborted) return { kind: 'aborted' }
      translation += chunk
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

const MAX_CANDIDATES = 5

async function firstAvailableSource(
  candidates: string[],
  target: string,
): Promise<string | null | 'timed-out'> {
  const seen = new Set<string>()
  for (const lang of candidates.slice(0, MAX_CANDIDATES)) {
    if (lang === target || seen.has(lang)) continue
    seen.add(lang)
    try {
      const availability = await withWatchdog(
        () => Translator.availability({ sourceLanguage: lang, targetLanguage: target }),
        PROBE_TIMEOUT_MS,
      )
      // A hanging probe is dead infrastructure, not an unavailable pair; escalate so the
      // caller can fall back to the offline engine instead of blaming the language.
      if (availability === 'timed-out') return 'timed-out'
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
