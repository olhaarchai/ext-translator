import type { TranslateOutcome, TranslateProgress } from '../translate'
import {
  OFFLINE_PORT,
  type EnsureOffscreenResponse,
  type OfflineQuote,
  type OfflineRequest,
  type OfflineResponse,
} from './offline-messages'

// A far lower ceiling than the built-in path: the fallback engine runs on the CPU, and a
// page-sized selection would occupy it for minutes.
export const OFFLINE_MAX_CHARS = 5000

export function truncateForOffline(rawText: string): { text: string; truncated: boolean } {
  const truncated = rawText.length > OFFLINE_MAX_CHARS
  return { text: truncated ? rawText.slice(0, OFFLINE_MAX_CHARS) : rawText, truncated }
}

/** Asks the background worker to spin up the engine's offscreen document. */
export async function ensureOfflineEngine(): Promise<boolean> {
  try {
    const response = (await chrome.runtime.sendMessage({ type: 'offline-ensure' })) as
      | EnsureOffscreenResponse
      | undefined
    return response?.ok === true
  } catch {
    return false
  }
}

export function quoteOffline(rawText: string, targetLanguage: string): Promise<OfflineQuote> {
  const { text } = truncateForOffline(rawText)
  return new Promise((resolve) => {
    const port = chrome.runtime.connect({ name: OFFLINE_PORT })
    let settled = false
    port.onMessage.addListener((message: OfflineResponse) => {
      if (message.type !== 'quote-result') return
      settled = true
      port.disconnect()
      resolve(message.quote)
    })
    port.onDisconnect.addListener(() => {
      if (!settled) resolve({ kind: 'error', error: 'translation-failed' })
    })
    port.postMessage({ type: 'quote', text, targetLanguage } satisfies OfflineRequest)
  })
}

export function translateOffline(
  rawText: string,
  targetLanguage: string,
  onProgress: (progress: TranslateProgress) => void,
  onPartial: (translation: string) => void,
  signal: AbortSignal,
): Promise<TranslateOutcome> {
  const { text, truncated } = truncateForOffline(rawText)
  return new Promise((resolve) => {
    const port = chrome.runtime.connect({ name: OFFLINE_PORT })
    let settled = false
    const settle = (outcome: TranslateOutcome) => {
      if (settled) return
      settled = true
      port.disconnect()
      resolve(outcome)
    }

    signal.addEventListener('abort', () => settle({ kind: 'aborted' }))

    port.onMessage.addListener((message: OfflineResponse) => {
      if (signal.aborted) return
      if (message.type === 'progress') onProgress(message.progress)
      else if (message.type === 'partial') onPartial(message.translation)
      else if (message.type === 'outcome') {
        settle(message.outcome.kind === 'result' ? { ...message.outcome, truncated } : message.outcome)
      }
    })
    // The engine page going away mid-job would otherwise leave the bubble spinning forever.
    port.onDisconnect.addListener(() => settle({ kind: 'error', error: 'translation-failed' }))

    port.postMessage({ type: 'translate', text, targetLanguage } satisfies OfflineRequest)
  })
}
