import { hasVoiceFor, speakToggle, speechAvailable } from './speech'

export function speakerButton(text: string, lang: string): HTMLButtonElement | null {
  if (!speechAvailable()) return null

  const button = document.createElement('button')
  button.className = 'speak'
  button.type = 'button'
  button.textContent = '🔊'

  const enabled = hasVoiceFor(lang)
  button.disabled = !enabled
  const label = enabled ? 'Listen' : 'No voice available for this language'
  button.title = label
  button.setAttribute('aria-label', label)

  button.addEventListener('click', (event) => {
    if (!event.isTrusted) return
    speakToggle(text, lang)
  })

  return button
}
