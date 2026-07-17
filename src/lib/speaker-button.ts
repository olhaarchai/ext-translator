import { languageLabel } from './languages'
import { hasVoiceFor, speakToggle, speechAvailable } from './speech'

const SVG_NS = 'http://www.w3.org/2000/svg'

// An inline speaker glyph rather than the 🔊 emoji: emoji render inconsistently across
// platforms — on some they show as a muted/struck speaker — while this inherits the text
// colour and draws identically everywhere.
function speakerIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', '15')
  svg.setAttribute('height', '15')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')

  const cone = document.createElementNS(SVG_NS, 'path')
  cone.setAttribute('d', 'M4 9v6h4l5 4V5L8 9H4z')
  cone.setAttribute('fill', 'currentColor')
  svg.append(cone)

  for (const d of ['M16 8.8a3.6 3.6 0 0 1 0 6.4', 'M18.7 6.2a7 7 0 0 1 0 11.6']) {
    const wave = document.createElementNS(SVG_NS, 'path')
    wave.setAttribute('d', d)
    wave.setAttribute('fill', 'none')
    wave.setAttribute('stroke', 'currentColor')
    wave.setAttribute('stroke-width', '2')
    wave.setAttribute('stroke-linecap', 'round')
    svg.append(wave)
  }
  return svg
}

export function speakerButton(text: string, lang: string): HTMLButtonElement | null {
  if (!speechAvailable()) return null

  const button = document.createElement('button')
  button.className = 'speak'
  button.type = 'button'
  button.append(speakerIcon())

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
