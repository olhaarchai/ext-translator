import type { TranslateError, TranslateOutcome, TranslateProgress } from '../translate'

export const OFFLINE_PORT = 'offline-translate'

export type EnsureOffscreenMessage = { type: 'offline-ensure' }
export type EnsureOffscreenResponse = { ok: boolean }

export type OfflineRequest =
  | { type: 'quote'; text: string; targetLanguage: string }
  | { type: 'translate'; text: string; targetLanguage: string }

/** What enabling offline translation for this selection would involve, shown pre-consent. */
export type OfflineQuote =
  | { kind: 'ready'; sourceLanguage: string; downloadBytes: number }
  | { kind: 'same-language'; language: string }
  | { kind: 'error'; error: TranslateError; sourceLanguage?: string }

export type OfflineResponse =
  | { type: 'quote-result'; quote: OfflineQuote }
  | { type: 'progress'; progress: TranslateProgress }
  | { type: 'partial'; translation: string }
  | { type: 'outcome'; outcome: TranslateOutcome }
