import { BUBBLE_WIDTH, bubblePosition, clampTop, type AnchorRect } from './bubble-position'
import { SUPPORTED_TARGETS, languageLabel } from './languages'
import { getTargetLanguage, grantConsent, hasConsent, setTargetLanguage } from './settings'
import {
  MAX_CHARS,
  translateSelection,
  type TranslateError,
  type TranslateOutcome,
  type TranslateProgress,
} from './translate'
import { speakerButton } from './speaker-button'
import { stopSpeaking } from './speech'
import { voicePicker } from './voice-picker'
import { vocabAdd, vocabHas, vocabRemove } from './vocab-client'
import { keyOf, normalizeSourceText, type VocabEntry } from './vocab-types'

const HOST_ID = 'ext-translator-host'

let teardown: (() => void) | null = null
let activeRoot: HTMLElement | null = null
let refreshSaved: (() => void) | null = null
let currentRun: AbortController | null = null

export function bubbleRootForTest(): HTMLElement | null {
  return activeRoot
}

export function notifyVocabChanged(): void {
  refreshSaved?.()
}

export async function openBubble(fallbackText: string): Promise<void> {
  closeBubble()

  const text = (currentSelectionText() || fallbackText).trim()
  if (text === '') return

  const anchor = selectionAnchorRect()
  const host = document.createElement('div')
  host.id = HOST_ID
  const shadow = host.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = BUBBLE_CSS
  shadow.appendChild(style)

  const root = el('div', 'bubble')
  shadow.appendChild(root)
  activeRoot = root
  document.documentElement.appendChild(host)

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') closeBubble()
  }
  const onPointerDown = (event: Event) => {
    if (!event.composedPath().includes(host)) closeBubble()
  }
  document.addEventListener('keydown', onKeydown, true)
  document.addEventListener('pointerdown', onPointerDown, true)
  teardown = () => {
    document.removeEventListener('keydown', onKeydown, true)
    document.removeEventListener('pointerdown', onPointerDown, true)
    host.remove()
    activeRoot = null
  }

  const bubble = new Bubble(root, text, anchor)
  if (await hasConsent()) {
    await bubble.start()
  } else {
    bubble.renderConsent()
  }
}

export function closeBubble(): void {
  stopSpeaking()
  currentRun?.abort()
  currentRun = null
  teardown?.()
  teardown = null
  refreshSaved = null
}

class Bubble {
  private runId = 0

  constructor(
    private readonly root: HTMLElement,
    private readonly text: string,
    private readonly anchor: AnchorRect | null,
  ) {}

  private placedTop: number | null = null

  private place(): void {
    const height = this.root.offsetHeight

    // Anchor once. Later renders only re-clamp: by then the user may have scrolled, and
    // the anchor would point at text that is no longer where it was.
    if (this.placedTop === null) {
      const { top, left } = bubblePosition(this.anchor, height, window.innerWidth, window.innerHeight)
      this.placedTop = top
      this.root.style.left = `${left}px`
    } else {
      this.placedTop = clampTop(this.placedTop, height, window.innerHeight)
    }

    this.root.style.top = `${this.placedTop}px`
  }

  renderConsent(): void {
    const message = el(
      'p',
      'message',
      "Translations run on-device using the browser's built-in model. " +
        'Selected text is processed locally and never leaves your browser.',
    )
    const agree = button('Agree and translate', () => {
      void grantConsent().then(() => this.start())
    })
    this.root.replaceChildren(message, agree)
    this.place()
  }

  async start(): Promise<void> {
    await this.run(await getTargetLanguage())
  }

  private async run(target: string): Promise<void> {
    const id = ++this.runId

    // Switching target language mid-stream must stop the previous translation, or its
    // remaining chunks would keep arriving behind the new one.
    currentRun?.abort()
    const controller = new AbortController()
    currentRun = controller

    this.renderStatus('Detecting language…')
    const outcome = await translateSelection(
      this.text,
      target,
      (progress) => {
        if (id === this.runId) this.renderStatus(progressText(progress))
      },
      (partial) => {
        if (id === this.runId) this.renderPartial(partial)
      },
      controller.signal,
    )
    if (id === this.runId) this.renderOutcome(outcome, target)
  }

  private renderPartial(translation: string): void {
    refreshSaved = null
    const header = el('div', 'head')
    header.append(el('span', 'meta', 'Translating…'))
    this.root.replaceChildren(header, el('p', 'translation', translation))
    this.place()
  }

  private renderStatus(text: string): void {
    refreshSaved = null
    this.root.replaceChildren(el('p', 'message', text))
    this.place()
  }

  private renderOutcome(outcome: TranslateOutcome, target: string): void {
    // An aborted run leaves whatever replaced it on screen.
    if (outcome.kind === 'aborted') return

    refreshSaved = null
    const nodes: HTMLElement[] = []

    if (outcome.kind === 'result') {
      const header = el('div', 'head')
      header.append(el('span', 'meta', `${languageLabel(outcome.sourceLanguage)} → ${languageLabel(target)}`))
      const speaker = speakerButton(this.text, outcome.sourceLanguage)
      if (speaker) header.append(speaker)
      const picker = voicePicker(outcome.sourceLanguage)
      if (picker) header.append(picker)
      nodes.push(header)
      nodes.push(el('p', 'translation', outcome.translation))
      if (outcome.truncated) {
        nodes.push(el('p', 'meta', `Only the first ${MAX_CHARS} characters were translated.`))
      }
      nodes.push(this.buildSaveControl(this.entryFor(outcome, target)))
    } else if (outcome.kind === 'same-language') {
      nodes.push(el('p', 'message', `The selected text is already in ${languageLabel(outcome.language)}.`))
    } else {
      nodes.push(el('p', 'message', errorText(outcome.error, outcome.sourceLanguage, target)))
      if (outcome.error === 'needs-activation') {
        nodes.push(button('Translate', () => void this.run(target)))
      } else if (outcome.error === 'download-failed' || outcome.error === 'translation-failed') {
        nodes.push(button('Retry', () => void this.run(target)))
      }
    }

    if (!(outcome.kind === 'error' && outcome.error === 'unsupported-browser')) {
      nodes.push(this.footer(target))
    }
    this.root.replaceChildren(...nodes)
    this.place()
  }

  private entryFor(outcome: Extract<TranslateOutcome, { kind: 'result' }>, target: string): VocabEntry {
    const source = outcome.truncated ? normalizeSourceText(this.text.slice(0, MAX_CHARS)) : this.text
    return {
      sourceText: source,
      translation: outcome.translation,
      sourceLanguage: outcome.sourceLanguage,
      targetLanguage: target,
      addedAt: Date.now(),
    }
  }

  private buildSaveControl(entry: VocabEntry): HTMLElement {
    const wrap = el('div', 'save')
    const key = keyOf(entry)

    const render = (saved: boolean) => {
      wrap.replaceChildren(
        saved
          ? button('Saved ✓ — remove', () => void vocabRemove(key).then(() => render(false)))
          : button('Save to vocabulary', () => void vocabAdd(entry).then(() => render(true))),
      )
    }

    wrap.replaceChildren(el('span', 'meta', 'Checking vocabulary…'))
    refreshSaved = () => void vocabHas(key).then(render)
    refreshSaved()
    return wrap
  }

  private footer(target: string): HTMLElement {
    const footer = el('div', 'footer')
    const label = el('label', 'meta', 'Translate to ')
    const select = document.createElement('select')
    for (const code of SUPPORTED_TARGETS) {
      const option = document.createElement('option')
      option.value = code
      option.textContent = languageLabel(code)
      option.selected = code === target
      select.appendChild(option)
    }
    select.addEventListener('change', () => {
      void setTargetLanguage(select.value).then(() => this.run(select.value))
    })
    label.appendChild(select)
    footer.appendChild(label)
    return footer
  }
}

function progressText(progress: TranslateProgress): string {
  switch (progress.kind) {
    case 'detecting':
      return 'Detecting language…'
    case 'downloading':
      return `Downloading language pack… ${Math.round(progress.progress * 100)}%`
    case 'translating':
      return 'Translating…'
  }
}

function errorText(error: TranslateError, source: string | undefined, target: string): string {
  switch (error) {
    case 'unsupported-browser':
      return (
        'Built-in translation is not available here. ' +
        'It requires a desktop browser with on-device translation (Chrome 138 or newer).'
      )
    case 'detection-failed':
      return 'Could not detect the language of the selected text.'
    case 'pair-unavailable':
      return `Translation from ${languageLabel(source ?? 'und')} to ${languageLabel(target)} is not available.`
    case 'download-failed':
      return 'Downloading the translation model failed. Check your connection and try again.'
    case 'needs-activation':
      return 'The browser needs a click to start translating.'
    case 'translation-failed':
      return 'Translation failed. Please try again.'
  }
}

function currentSelectionText(): string {
  return window.getSelection()?.toString() ?? ''
}

// Anchor to the selection's first line, so a multi-line selection does not drag the
// bubble to the far corner of its bounding box.
function selectionAnchorRect(): AnchorRect | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return null
  return rect
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function button(label: string, onClick: () => void): HTMLElement {
  const node = document.createElement('button')
  node.className = 'action'
  node.textContent = label
  node.addEventListener('click', (event) => {
    if (!event.isTrusted) return
    onClick()
  })
  return node
}

const BUBBLE_CSS = `
:host {
  all: initial;
}
.bubble {
  --bubble-bg: #ffffff;
  position: fixed;
  z-index: 2147483647;
  width: ${BUBBLE_WIDTH}px;
  max-width: calc(100vw - 16px);
  max-height: 60vh;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 12px;
  background: var(--bubble-bg);
  color: #1a1a1a;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  font: 14px/1.45 system-ui, sans-serif;
}
.message,
.translation {
  margin: 0 0 8px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.meta {
  margin: 0 0 6px;
  font-size: 12px;
  opacity: 0.7;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  position: sticky;
  /* Pull up over the bubble's own padding: it scrolls too, so text would otherwise
     show through the gap above a header pinned at top: 0. */
  top: -12px;
  z-index: 1;
  background: var(--bubble-bg);
  margin: -12px -12px 6px;
  padding: 12px 12px 6px;
}
.head .meta {
  margin: 0;
}
.voice {
  font: inherit;
  font-size: 12px;
  max-width: 130px;
  margin-left: auto;
}
.speak {
  font: inherit;
  font-size: 13px;
  line-height: 1;
  padding: 2px 6px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
.speak:disabled {
  opacity: 0.4;
  cursor: default;
}
.save {
  margin: 6px 0 2px;
}
.footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
select {
  font: inherit;
  font-size: 12px;
  max-width: 180px;
}
.action {
  font: inherit;
  padding: 4px 12px;
  border: 1px solid rgba(0, 0, 0, 0.25);
  border-radius: 6px;
  background: #f5f5f5;
  color: inherit;
  cursor: pointer;
}
.action:hover {
  background: #ebebeb;
}
@media (prefers-color-scheme: dark) {
  .bubble {
    --bubble-bg: #242424;
    color: #ececec;
    border-color: rgba(255, 255, 255, 0.15);
  }
  .action {
    background: #333333;
    border-color: rgba(255, 255, 255, 0.25);
  }
  .action:hover {
    background: #3d3d3d;
  }
  .speak {
    border-color: rgba(255, 255, 255, 0.25);
  }
}
`
