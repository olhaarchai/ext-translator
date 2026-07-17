import { languageLabel } from './languages'
import { hasVoiceFor, speakToggle, speechAvailable } from './speech'

export function speakerButton(text: string, lang: string): HTMLButtonElement | null {
  if (!speechAvailable()) return null

  const button = document.createElement('button')
  button.className = 'speak'
  button.type = 'button'
  button.textContent = '🔊'

  const enabled = hasVoiceFor(lang)
  button.disabled = !enabled
  // Two of these now sit side by side, so the label names its language. When there is no
  // voice it also says what would fix it: most systems ship voices for the interface
  // language and little else, and a bare "not available" reads as a broken extension
  // rather than a missing download the reader can go and get.
  const label = enabled
    ? `Listen in ${languageLabel(lang)}`
    : `No ${languageLabel(lang)} voice is installed. Add one in your system's speech settings to listen.`
  button.title = label
  button.setAttribute('aria-label', label)

  button.addEventListener('click', (event) => {
    if (!event.isTrusted) return
    speakToggle(text, lang)
  })

  return button
}
