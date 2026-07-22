import { LatencyOptimisedTranslator } from '@browsermt/bergamot-translator/translator.js'
import type { TranslateOutcome, TranslateProgress } from '../translate'
import { isPassthrough, splitForStreaming } from './chunk'
import { detectSource } from './detect'
import { unwrapSingleWord, wrapSingleWord } from './single-word'
import { hasVerified } from './model-store'
import { filesFor, modelsFor, type LanguagePair } from './registry'
import { DownloadError, PinnedBacking } from './pinned-backing'
import type { OfflineQuote } from './offline-messages'

export class OfflineEngine {
  private backing: PinnedBacking | null = null
  private translator: LatencyOptimisedTranslator | null = null

  /** Costs nothing irreversible: pure detection plus registry/cache lookups, no network. */
  async quote(text: string, targetLanguage: string): Promise<OfflineQuote> {
    const source = detectSource(text)
    if (source === null) return { kind: 'error', error: 'detection-failed' }
    if (source === targetLanguage) return { kind: 'same-language', language: targetLanguage }

    const pairs = modelsFor(source, targetLanguage)
    if (pairs === null) return { kind: 'error', error: 'pair-unavailable', sourceLanguage: source }

    return { kind: 'ready', sourceLanguage: source, downloadBytes: await this.missingBytes(pairs) }
  }

  async translate(
    text: string,
    targetLanguage: string,
    onProgress: (progress: TranslateProgress) => void,
    onPartial: (translation: string) => void,
    signal: AbortSignal,
  ): Promise<TranslateOutcome> {
    onProgress({ kind: 'detecting' })
    const quote = await this.quote(text, targetLanguage)
    if (quote.kind === 'same-language') return { kind: 'same-language', language: quote.language }
    if (quote.kind === 'error') return { kind: 'error', error: quote.error, sourceLanguage: quote.sourceLanguage }
    const source = quote.sourceLanguage

    const backing = this.backing ?? new PinnedBacking()
    this.backing = backing
    const translator = this.translator ?? new LatencyOptimisedTranslator({}, backing)
    this.translator = translator

    // Only one job runs at a time (jobs are serialized per bubble), so the shared
    // progress hook can be reclaimed for this job's download accounting.
    let loaded = 0
    const total = quote.downloadBytes
    backing.onBytes = (delta) => {
      loaded += delta
      if (total > 0) onProgress({ kind: 'downloading', progress: Math.min(loaded / total, 1) })
    }
    if (total > 0) onProgress({ kind: 'downloading', progress: 0 })

    try {
      const wrap = wrapSingleWord(text)
      if (wrap !== null) {
        const response = await translator.translate(
          { from: source, to: targetLanguage, text: wrap.wrapped, html: false },
          { signal },
        )
        if (signal.aborted) return { kind: 'aborted' }
        onProgress({ kind: 'translating' })
        const translation = unwrapSingleWord(response.target.text, wrap)
        onPartial(translation)
        return { kind: 'result', translation, sourceLanguage: source, truncated: false }
      }

      let translation = ''
      let previousWasText = false
      let started = false
      for (const chunk of splitForStreaming(text)) {
        if (signal.aborted) return { kind: 'aborted' }
        if (isPassthrough(chunk)) {
          translation += chunk
          previousWasText = false
          continue
        }
        const response = await translator.translate(
          { from: source, to: targetLanguage, text: chunk, html: false },
          { signal },
        )
        if (!started) {
          started = true
          onProgress({ kind: 'translating' })
        }
        // Sentence splitting consumed the single space between adjacent text chunks.
        if (previousWasText) translation += ' '
        translation += response.target.text
        previousWasText = true
        onPartial(translation)
      }
      if (signal.aborted) return { kind: 'aborted' }
      return { kind: 'result', translation, sourceLanguage: source, truncated: false }
    } catch (error) {
      if (signal.aborted) return { kind: 'aborted' }
      if (error instanceof DownloadError) return { kind: 'error', error: 'download-failed', sourceLanguage: source }
      return { kind: 'error', error: 'translation-failed', sourceLanguage: source }
    } finally {
      backing.onBytes = null
    }
  }

  private async missingBytes(pairs: LanguagePair[]): Promise<number> {
    let bytes = 0
    for (const file of pairs.flatMap(filesFor)) {
      if (!(await hasVerified(file.url, file.sha256))) bytes += file.size
    }
    return bytes
  }
}
