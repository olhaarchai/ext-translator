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

export function hasVoiceFor(lang: string): boolean {
  if (!speechAvailable()) return false
  const voices = speechSynthesis.getVoices()
  if (voices.length === 0) return true
  return voices.some((voice) => baseLang(voice.lang) === baseLang(lang))
}

function voiceScore(voice: SpeechSynthesisVoice): number {
  const name = (voice.name ?? '').toLowerCase()
  let score = 0
  if (name.includes('siri')) score += 5
  if (/enhanced|premium|neural|natural/.test(name)) score += 3
  if (voice.localService) score += 1
  if (voice.default) score += 1
  return score
}

export function voicesForLanguage(lang: string): SpeechSynthesisVoice[] {
  if (!speechAvailable()) return []
  const base = baseLang(lang)
  return speechSynthesis.getVoices().filter((voice) => baseLang(voice.lang) === base)
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const matches = voicesForLanguage(lang)
  if (matches.length === 0) return null

  const preferred = preferredVoiceURI(lang)
  if (preferred !== undefined) {
    const chosen = matches.find((voice) => voice.voiceURI === preferred)
    if (chosen) return chosen
  }

  return matches.reduce((best, voice) => (voiceScore(voice) > voiceScore(best) ? voice : best))
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

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  const voice = pickVoice(lang)
  if (voice) utterance.voice = voice
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
