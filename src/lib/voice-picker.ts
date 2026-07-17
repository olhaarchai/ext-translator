import { languageLabel } from './languages'
import { defaultVoiceFor, speechAvailable, voicesForLanguage } from './speech'
import { preferredVoiceURI, setPreferredVoice } from './voice-prefs'

const ORIGIN_NOTE = 'Spoken on your device by a system voice — nothing is sent to a server.'

/**
 * The voice affordance for a language. It is always shown once speech exists at all, even
 * when there is a single voice or none: a control that simply vanishes reads as something
 * broken rather than as "there is one voice" or "your system has none". Returns null only
 * when the browser cannot speak at all, where no speaker is shown either.
 *
 * - Two or more voices: a compact caret that opens the browser's own chooser.
 * - Exactly one voice: the same caret, so the current voice is visible on hover though
 *   there is nothing to switch to.
 * - No voice: a plain badge that says so and, on hover, how to fix it.
 */
export function voiceControl(lang: string): HTMLElement | null {
  if (!speechAvailable()) return null
  const voices = voicesForLanguage(lang)
  return voices.length === 0 ? noVoiceBadge(lang) : picker(lang, voices)
}

function noVoiceBadge(lang: string): HTMLElement {
  const badge = document.createElement('span')
  badge.className = 'voice-none'
  badge.textContent = 'No system voice'
  badge.title = `Your system has no on-device ${languageLabel(lang)} voice. Add one in its speech settings to listen. ${ORIGIN_NOTE}`
  return badge
}

function picker(lang: string, voices: SpeechSynthesisVoice[]): HTMLElement {
  const select = document.createElement('select')
  select.className = 'voice-select'
  select.setAttribute('aria-label', `Voice for ${languageLabel(lang)}`)

  // With nothing stored yet, show the voice that would actually be used, not the first one.
  const selectedURI = preferredVoiceURI(lang) ?? defaultVoiceFor(lang)?.voiceURI
  for (const voice of voices) {
    const option = document.createElement('option')
    option.value = voice.voiceURI
    option.textContent = voice.name
    if (voice.voiceURI === selectedURI) option.selected = true
    select.append(option)
  }

  const caret = document.createElement('span')
  caret.className = 'voice-caret'
  caret.setAttribute('aria-hidden', 'true')
  caret.textContent = '▾'

  const wrap = document.createElement('span')
  wrap.className = 'voice'
  wrap.append(caret, select)

  const canChoose = voices.length > 1
  const syncTitle = () => {
    const name = select.options[select.selectedIndex]?.textContent ?? ''
    const action = canChoose ? 'Change it or add more' : 'Add more'
    const named = name === '' ? 'On-device system voice' : `${name} — on-device system voice`
    wrap.title = `${named}. ${action} in your system's speech settings. ${ORIGIN_NOTE}`
  }
  syncTitle()

  select.addEventListener('change', () => {
    void setPreferredVoice(lang, select.value)
    syncTitle()
  })

  return wrap
}
