import { preferredVoiceURI } from './voice-prefs'

function baseLang(lang: string): string {
  return lang.toLowerCase().split('-')[0] ?? ''
}

export function speechAvailable(): boolean {
  return (
    typeof globalThis.speechSynthesis !== 'undefined' &&
    typeof globalThis.SpeechSynthesisUtterance !== 'undefined'
  )
}

export function voicesLoaded(): boolean {
  return speechAvailable() && speechSynthesis.getVoices().length > 0
}

/**
 * On-device voices only. A network-backed voice (localService === false, e.g. Chrome's
 * bundled "Google <language>" voices) is synthesised server-side, so speaking with one
 * would send the user's selected text to the vendor — breaking the extension's promise
 * that nothing leaves the browser.
 */
export function voicesForLanguage(lang: string): SpeechSynthesisVoice[] {
  if (!speechAvailable()) return []
  const base = baseLang(lang)
  return speechSynthesis
    .getVoices()
    .filter((voice) => voice.localService && baseLang(voice.lang) === base)
}

export function hasVoiceFor(lang: string): boolean {
  return voicesForLanguage(lang).length > 0
}

function voiceScore(voice: SpeechSynthesisVoice): number {
  const name = (voice.name ?? '').toLowerCase()
  let score = 0
  if (name.includes('siri')) score += 5
  if (/enhanced|premium|neural|natural/.test(name)) score += 3
  if (voice.default) score += 1
  return score
}

export function defaultVoiceFor(lang: string): SpeechSynthesisVoice | null {
  const matches = voicesForLanguage(lang)
  if (matches.length === 0) return null
  return matches.reduce((best, voice) => (voiceScore(voice) > voiceScore(best) ? voice : best))
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const preferred = preferredVoiceURI(lang)
  if (preferred !== undefined) {
    const chosen = voicesForLanguage(lang).find((voice) => voice.voiceURI === preferred)
    if (chosen) return chosen
  }
  return defaultVoiceFor(lang)
}

let current: { text: string; lang: string } | null = null

export function speakToggle(text: string, lang: string): 'started' | 'stopped' {
  if (!speechAvailable()) return 'stopped'

  const wasSameAndSpeaking =
    speechSynthesis.speaking && current?.text === text && current.lang === lang

  speechSynthesis.cancel()
  if (wasSameAndSpeaking) {
    current = null
    return 'stopped'
  }

  // Never speak without an explicit on-device voice: left to itself the browser picks its
  // own default, which may be a network voice.
  const voice = pickVoice(lang)
  if (voice === null) {
    current = null
    return 'stopped'
  }

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  utterance.voice = voice
  utterance.onend = () => {
    if (current?.text === text) current = null
  }
  current = { text, lang }
  speechSynthesis.speak(utterance)
  return 'started'
}

export function stopSpeaking(): void {
  if (speechAvailable()) speechSynthesis.cancel()
  current = null
}

export function onVoicesChanged(callback: () => void): void {
  if (speechAvailable() && 'onvoiceschanged' in speechSynthesis) {
    speechSynthesis.addEventListener('voiceschanged', callback)
  }
}
