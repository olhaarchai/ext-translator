import { defaultTargetLanguage } from './languages'

const CONSENT_KEY = 'consentGiven'
const OFFLINE_CONSENT_KEY = 'offlineConsentGiven'
const TARGET_KEY = 'targetLanguage'
const SELECTION_ICON_KEY = 'selectionIconEnabled'

export async function hasConsent(): Promise<boolean> {
  const stored = await chrome.storage.local.get(CONSENT_KEY)
  return stored[CONSENT_KEY] === true
}

export async function grantConsent(): Promise<void> {
  await chrome.storage.local.set({ [CONSENT_KEY]: true })
}

const BUILTIN_DEAD_KEY = 'builtinTranslationDead'

/**
 * Chromium forks expose the built-in translation classes but hang behind them; proving
 * that takes watchdog timeouts. Remember the verdict for the browser session so only the
 * first translation pays the wait — and re-probe after a restart, when an update may
 * have brought the service to life.
 */
export async function isBuiltinDead(): Promise<boolean> {
  try {
    const stored = await chrome.storage.session.get(BUILTIN_DEAD_KEY)
    return stored[BUILTIN_DEAD_KEY] === true
  } catch {
    return false
  }
}

export async function markBuiltinDead(): Promise<void> {
  try {
    await chrome.storage.session.set({ [BUILTIN_DEAD_KEY]: true })
  } catch {
    // Session storage unavailable: the next translation re-probes, which only costs time.
  }
}

// Separate from the built-in consent: the offline disclosure additionally covers the
// one-time model download, so agreement to one does not imply the other.
export async function hasOfflineConsent(): Promise<boolean> {
  const stored = await chrome.storage.local.get(OFFLINE_CONSENT_KEY)
  return stored[OFFLINE_CONSENT_KEY] === true
}

export async function grantOfflineConsent(): Promise<void> {
  await chrome.storage.local.set({ [OFFLINE_CONSENT_KEY]: true })
}

export async function getTargetLanguage(): Promise<string> {
  const stored = await chrome.storage.local.get(TARGET_KEY)
  const value = stored[TARGET_KEY]
  if (typeof value === 'string' && value !== '') return value
  return defaultTargetLanguage(chrome.i18n.getUILanguage())
}

export async function setTargetLanguage(code: string): Promise<void> {
  await chrome.storage.local.set({ [TARGET_KEY]: code })
}

export async function isSelectionIconEnabled(): Promise<boolean> {
  const stored = await chrome.storage.local.get(SELECTION_ICON_KEY)
  return stored[SELECTION_ICON_KEY] !== false
}

export async function setSelectionIconEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [SELECTION_ICON_KEY]: enabled })
}
