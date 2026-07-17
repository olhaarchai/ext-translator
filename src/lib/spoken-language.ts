import { languageLabel } from './languages'
import { speakerButton } from './speaker-button'

/**
 * A language name together with the control that speaks that language's text.
 *
 * They are built as one unit because two now sit side by side — one for the original, one
 * for the translation. A speaker floating next to a bare "English → Turkish" gives the
 * reader no way to tell which of the two texts it will read out.
 */
export function spokenLanguage(text: string, lang: string, labelClass: string): HTMLElement {
  const group = document.createElement('span')
  group.className = 'lang'

  const speaker = speakerButton(text, lang)
  if (speaker !== null) group.append(speaker)

  const label = document.createElement('span')
  label.className = labelClass
  label.textContent = languageLabel(lang)
  group.append(label)

  return group
}
