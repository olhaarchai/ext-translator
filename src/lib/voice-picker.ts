import { defaultVoiceFor, voicesForLanguage } from './speech'
import { preferredVoiceURI, setPreferredVoice } from './voice-prefs'

export function voicePicker(lang: string): HTMLSelectElement | null {
  const voices = voicesForLanguage(lang)
  if (voices.length < 2) return null

  const select = document.createElement('select')
  select.className = 'voice'
  select.title = 'Voice'

  // With nothing stored yet, show the voice that would actually be used, not the first one.
  const selectedURI = preferredVoiceURI(lang) ?? defaultVoiceFor(lang)?.voiceURI
  for (const voice of voices) {
    const option = document.createElement('option')
    option.value = voice.voiceURI
    option.textContent = voice.name
    if (voice.voiceURI === selectedURI) option.selected = true
    select.append(option)
  }

  select.addEventListener('change', () => {
    void setPreferredVoice(lang, select.value)
  })

  return select
}
