import { voicesForLanguage } from './speech'
import { preferredVoiceURI, setPreferredVoice } from './voice-prefs'

export function voicePicker(lang: string): HTMLSelectElement | null {
  const voices = voicesForLanguage(lang)
  if (voices.length < 2) return null

  const select = document.createElement('select')
  select.className = 'voice'
  select.title = 'Voice'

  const current = preferredVoiceURI(lang)
  for (const voice of voices) {
    const option = document.createElement('option')
    option.value = voice.voiceURI
    option.textContent = voice.name
    if (voice.voiceURI === current) option.selected = true
    select.append(option)
  }

  select.addEventListener('change', () => {
    void setPreferredVoice(lang, select.value)
  })

  return select
}
