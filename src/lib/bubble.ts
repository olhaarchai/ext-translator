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
const BUBBLE_WIDTH = 340

let teardown: (() => void) | null = null
let activeRoot: HTMLElement | null = null
let refreshSaved: (() => void) | null = null

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

  const host = document.createElement('div')
  host.id = HOST_ID
  const shadow = host.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = BUBBLE_CSS
  shadow.appendChild(style)

  const root = el('div', 'bubble')
  applyPosition(root)
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

  const bubble = new Bubble(root, text)
  if (await hasConsent()) {
    await bubble.start()
  } else {
    bubble.renderConsent()
  }
}

export function closeBubble(): void {
  stopSpeaking()
  teardown?.()
  teardown = null
  refreshSaved = null
}

class Bubble {
  private runId = 0

  constructor(
    private readonly root: HTMLElement,
    private readonly text: string,
  ) {}

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
  }

  async start(): Promise<void> {
    await this.run(await getTargetLanguage())
  }

  private async run(target: string): Promise<void> {
    const id = ++this.runId
    this.renderStatus('Detecting language…')
    const outcome = await translateSelection(this.text, target, (progress) => {
      if (id === this.runId) this.renderStatus(progressText(progress))
    })
    if (id === this.runId) this.renderOutcome(outcome, target)
  }

  private renderStatus(text: string): void {
    refreshSaved = null
    this.root.replaceChildren(el('p', 'message', text))
  }

  private renderOutcome(outcome: TranslateOutcome, target: string): void {
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

function applyPosition(root: HTMLElement): void {
  const rect = selectionRect()
  if (!rect) {
    root.style.top = '16px'
    root.style.left = '50%'
    root.style.transform = 'translateX(-50%)'
    return
  }
  const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - BUBBLE_WIDTH - 8))
  root.style.left = `${left}px`
  if (rect.bottom + 240 <= window.innerHeight) {
    root.style.top = `${rect.bottom + 8}px`
  } else {
    root.style.top = `${Math.max(8, rect.top - 8)}px`
    root.style.transform = 'translateY(-100%)'
  }
}

function selectionRect(): DOMRect | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const rect = selection.getRangeAt(0).getBoundingClientRect()
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
  position: fixed;
  z-index: 2147483647;
  width: ${BUBBLE_WIDTH}px;
  max-width: calc(100vw - 16px);
  box-sizing: border-box;
  padding: 12px;
  background: #ffffff;
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
  margin-bottom: 6px;
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
    background: #242424;
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
