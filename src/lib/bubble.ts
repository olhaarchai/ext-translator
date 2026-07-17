import { BUBBLE_WIDTH, bubblePosition, clampTop, type AnchorRect } from './bubble-position'
import { hardenHost, randomHostId } from './extension-host'
import { languageLabel, targetsByLabel } from './languages'
import { getTargetLanguage, grantConsent, hasConsent, setTargetLanguage } from './settings'
import {
  MAX_CHARS,
  translateSelection,
  type TranslateError,
  type TranslateOutcome,
  type TranslateProgress,
} from './translate'
import { spokenLanguage } from './spoken-language'
import { onVoicesChanged, stopSpeaking } from './speech'
import { voiceControl } from './voice-picker'
import { vocabAdd, vocabHas, vocabRemove } from './vocab-client'
import { keyOf, normalizeSourceText, type VocabEntry } from './vocab-types'

const HOST_ID = randomHostId()

let teardown: (() => void) | null = null
let activeRoot: HTMLElement | null = null
let activeHost: HTMLElement | null = null
let refreshSaved: (() => void) | null = null
let rerenderOutcome: (() => void) | null = null
let activeBubble: Bubble | null = null
let voicesSubscribed = false

export function bubbleRootForTest(): HTMLElement | null {
  return activeRoot
}

export function currentBubbleHost(): HTMLElement | null {
  return activeHost
}

export function notifyVocabChanged(): void {
  refreshSaved?.()
}

export async function openBubble(fallbackText: string): Promise<void> {
  closeBubble()

  const text = (currentSelectionText() || fallbackText).trim()
  if (text === '') return

  // Voices load asynchronously; when they arrive, redraw so the speaker control and the
  // voice picker reflect what is actually available.
  if (!voicesSubscribed) {
    voicesSubscribed = true
    onVoicesChanged(() => rerenderOutcome?.())
  }

  const anchor = selectionAnchorRect()
  const host = document.createElement('div')
  host.id = HOST_ID
  hardenHost(host)
  activeHost = host
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
    activeHost = null
  }

  const bubble = new Bubble(root, text, anchor)
  activeBubble = bubble

  const consented = await hasConsent()
  // Escape or an outside click during that storage round-trip already tore this bubble
  // down; without this check we would translate for a bubble nobody can see, and nothing
  // would be left to abort it.
  if (activeRoot !== root) return

  if (consented) {
    await bubble.start()
  } else {
    bubble.renderConsent()
  }
}

export function closeBubble(): void {
  stopSpeaking()
  // Abort the bubble being closed, never "whoever happens to be running": a per-instance
  // controller keeps one bubble from cancelling another's translation.
  activeBubble?.abort()
  activeBubble = null
  teardown?.()
  teardown = null
  refreshSaved = null
  rerenderOutcome = null
}

class Bubble {
  private runId = 0
  private activeTarget: string | null = null
  private controller: AbortController | null = null
  private streamingBody: HTMLElement | null = null
  private statusBody: HTMLElement | null = null

  constructor(
    private readonly root: HTMLElement,
    private readonly text: string,
    private readonly anchor: AnchorRect | null,
  ) {}

  private placedTop: number | null = null

  abort(): void {
    this.controller?.abort()
    this.controller = null
  }

  /**
   * Only the mounted bubble may render or touch the module-level UI state. A run started
   * by a bubble that has since been closed or replaced can still resolve late — its
   * per-instance runId guard says nothing about other instances.
   */
  private isActive(): boolean {
    return activeRoot === this.root
  }

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
    if (!this.isActive()) return
    const message = el(
      'p',
      'message',
      "Translations run on-device using the browser's built-in model. " +
        'Selected text is processed locally and never leaves your browser.',
    )
    const agree = button('Agree and translate', () => {
      void grantConsent().then(() => this.start())
    })
    this.streamingBody = null
    this.statusBody = null
    this.root.replaceChildren(message, agree)
    this.place()
  }

  async start(): Promise<void> {
    if (!this.isActive()) return
    const target = await getTargetLanguage()
    await this.run(target)
  }

  private async run(target: string): Promise<void> {
    // A continuation from a torn-down bubble (consent granted, language switched, storage
    // resolved) must not start work or touch shared state. Checked before the abort below,
    // not after.
    if (!this.isActive()) return

    const id = ++this.runId
    this.activeTarget = target

    // Switching target language mid-stream must stop the previous translation, or its
    // remaining chunks would keep arriving behind the new one.
    this.controller?.abort()
    const controller = new AbortController()
    this.controller = controller

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

  /**
   * Chunks arrive several times a second. Rebuilding the subtree each time would detach
   * the footer's <select> — and detaching it dismisses its open dropdown without
   * committing, making the picker impossible to actually use mid-stream. So build once
   * and afterwards only write the text.
   */
  private renderPartial(translation: string): void {
    if (!this.isActive()) return
    refreshSaved = null
    rerenderOutcome = null

    this.statusBody = null
    if (this.streamingBody === null) {
      const header = el('div', 'head')
      header.append(el('span', 'meta', 'Translating…'))
      const body = el('p', 'translation', '')
      this.streamingBody = body
      this.root.replaceChildren(header, body, ...this.inProgressFooter())
    }

    this.streamingBody.textContent = translation
    this.place()
  }

  private renderStatus(text: string): void {
    if (!this.isActive()) return
    refreshSaved = null
    rerenderOutcome = null
    this.streamingBody = null

    // Download progress repeats too; same reason as renderPartial — build once, then write.
    if (this.statusBody === null) {
      const body = el('p', 'message', '')
      this.statusBody = body
      this.root.replaceChildren(body, ...this.inProgressFooter())
    }

    this.statusBody.textContent = text
    this.place()
  }

  // The language picker must stay reachable while a long translation streams, otherwise
  // switching target mid-stream is impossible.
  private inProgressFooter(): HTMLElement[] {
    return this.activeTarget === null ? [] : [this.footer(this.activeTarget)]
  }

  private renderOutcome(outcome: TranslateOutcome, target: string): void {
    // An aborted run leaves whatever replaced it on screen.
    if (outcome.kind === 'aborted' || !this.isActive()) return

    refreshSaved = null
    this.streamingBody = null
    this.statusBody = null
    rerenderOutcome = () => this.renderOutcome(outcome, target)
    const nodes: HTMLElement[] = []

    if (outcome.kind === 'result') {
      // Speak and save exactly what was translated, not the part beyond the ceiling.
      const source = this.translatedSource(outcome)
      const header = el('div', 'head')
      header.append(
        spokenLanguageWithPicker(source, outcome.sourceLanguage),
        el('span', 'meta', '→'),
        spokenLanguageWithPicker(outcome.translation, target),
      )
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

  private translatedSource(outcome: Extract<TranslateOutcome, { kind: 'result' }>): string {
    return outcome.truncated ? normalizeSourceText(this.text.slice(0, MAX_CHARS)) : this.text
  }

  private entryFor(outcome: Extract<TranslateOutcome, { kind: 'result' }>, target: string): VocabEntry {
    const source = this.translatedSource(outcome)
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
    for (const code of targetsByLabel()) {
      const option = document.createElement('option')
      option.value = code
      option.textContent = languageLabel(code)
      option.selected = code === target
      select.appendChild(option)
    }
    select.addEventListener('change', () => {
      const chosen = select.value
      // Adopt the choice now, not after the storage write: a chunk landing in that window
      // would otherwise repaint the footer with the previous language.
      this.activeTarget = chosen
      void setTargetLanguage(chosen).then(() => this.run(chosen))
    })
    label.appendChild(select)
    footer.appendChild(label)
    return footer
  }
}

function spokenLanguageWithPicker(text: string, lang: string): HTMLElement {
  const group = spokenLanguage(text, lang, 'meta')
  const control = voiceControl(lang)
  if (control !== null) group.append(control)
  return group
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
  /* Two languages, each with a control and possibly a voice picker, outgrow one line in a
     narrow bubble. */
  flex-wrap: wrap;
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
.lang {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.voice {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: currentColor;
  opacity: 0.7;
  cursor: pointer;
}
.voice:hover {
  background: rgba(0, 0, 0, 0.06);
  opacity: 1;
}
.voice:focus-within {
  outline: 2px solid rgba(0, 0, 0, 0.35);
  opacity: 1;
}
.voice-caret {
  font-size: 12px;
  line-height: 1;
  pointer-events: none;
}
.voice-none {
  font-size: 11px;
  line-height: 1;
  padding: 2px 6px;
  border: 1px solid currentColor;
  border-radius: 6px;
  opacity: 0.55;
  white-space: nowrap;
  cursor: help;
}
/* A real, focusable select laid invisibly over the caret: the native dropdown and its
   keyboard handling stay, while only the caret shows. */
.voice-select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  opacity: 0;
  cursor: pointer;
  font: inherit;
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
  .voice:hover {
    background: rgba(255, 255, 255, 0.12);
  }
  .voice:focus-within {
    outline-color: rgba(255, 255, 255, 0.45);
  }
}
`
