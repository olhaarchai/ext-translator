import { openBubble } from './bubble'
import { isSelectionIconEnabled } from './settings'

const HOST_ID = 'ext-translator-selection-icon'
const BUBBLE_HOST_ID = 'ext-translator-host'
const ICON_SIZE = 28
const GAP = 6

let host: HTMLElement | null = null
let iconButton: HTMLButtonElement | null = null

export function installSelectionIcon(): void {
  document.addEventListener('mouseup', onMouseUp, true)
  document.addEventListener('selectionchange', onSelectionChange)
  document.addEventListener('keydown', onKeydown, true)
  window.addEventListener('scroll', hideSelectionIcon, true)
  window.addEventListener('resize', hideSelectionIcon)
}

export function hideSelectionIcon(): void {
  host?.remove()
  host = null
  iconButton = null
}

export function selectionIconHostForTest(): HTMLElement | null {
  return host
}

export function selectionIconButtonForTest(): HTMLButtonElement | null {
  return iconButton
}

function onMouseUp(event: MouseEvent): void {
  if (host && event.composedPath().includes(host)) return
  setTimeout(() => void maybeShowIcon(), 0)
}

function onSelectionChange(): void {
  if (currentText() === '') hideSelectionIcon()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') hideSelectionIcon()
}

async function maybeShowIcon(): Promise<void> {
  if (!(await isSelectionIconEnabled())) {
    hideSelectionIcon()
    return
  }

  const selection = window.getSelection()
  const text = selection?.toString().trim() ?? ''
  if (text === '' || !selection || insideExtensionUI(selection)) {
    hideSelectionIcon()
    return
  }

  const rect = anchorRect(selection)
  if (!rect) {
    hideSelectionIcon()
    return
  }

  showIcon(rect, text)
}

function showIcon(rect: DOMRect, text: string): void {
  hideSelectionIcon()

  host = document.createElement('div')
  host.id = HOST_ID
  const shadow = host.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = ICON_CSS
  shadow.appendChild(style)

  const button = document.createElement('button')
  button.className = 'icon'
  button.type = 'button'
  button.textContent = '🌐'
  button.title = 'Translate selection'
  button.setAttribute('aria-label', 'Translate selection')
  // Prefer sitting above the first line; drop below it when there is no room above.
  const above = rect.top - ICON_SIZE - GAP
  const top = above >= 0 ? above : rect.bottom + GAP
  button.style.top = `${top + window.scrollY}px`
  button.style.left = `${rect.left + window.scrollX}px`

  // Keep the selection alive so the bubble can read and anchor to it.
  button.addEventListener('mousedown', (event) => event.preventDefault())
  button.addEventListener('click', (event) => {
    if (!event.isTrusted) return
    hideSelectionIcon()
    void openBubble(text)
  })

  shadow.appendChild(button)
  iconButton = button
  document.documentElement.appendChild(host)
}

function currentText(): string {
  return window.getSelection()?.toString().trim() ?? ''
}

function insideExtensionUI(selection: Selection): boolean {
  const node = selection.anchorNode
  if (!node) return false

  const root = node.getRootNode()
  if (root instanceof ShadowRoot) {
    const id = (root.host as HTMLElement).id
    return id === HOST_ID || id === BUBBLE_HOST_ID
  }

  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  return element !== null && element.closest(`#${HOST_ID}, #${BUBBLE_HOST_ID}`) !== null
}

// The first client rect is the selection's first line, so the icon stays at the start of
// the selection instead of drifting to the far corner of a multi-line bounding box.
function anchorRect(selection: Selection): DOMRect | null {
  if (selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  return range.getClientRects()[0] ?? range.getBoundingClientRect()
}

const ICON_CSS = `
:host {
  all: initial;
}
.icon {
  position: absolute;
  z-index: 2147483646;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 15px;
  line-height: 1;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
  cursor: pointer;
}
.icon:hover {
  background: #f0f0f0;
}
@media (prefers-color-scheme: dark) {
  .icon {
    background: #2a2a2a;
    border-color: rgba(255, 255, 255, 0.2);
  }
  .icon:hover {
    background: #363636;
  }
}
`
