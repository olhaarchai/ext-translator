import { defaultTargetLanguage } from './languages'

const CONSENT_KEY = 'consentGiven'
const TARGET_KEY = 'targetLanguage'

export async function hasConsent(): Promise<boolean> {
  const stored = await chrome.storage.local.get(CONSENT_KEY)
  return stored[CONSENT_KEY] === true
}

export async function grantConsent(): Promise<void> {
  await chrome.storage.local.set({ [CONSENT_KEY]: true })
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
