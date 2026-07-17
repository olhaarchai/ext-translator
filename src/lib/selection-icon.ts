import { currentBubbleHost, openBubble } from './bubble'
import { hardenHost, randomHostId } from './extension-host'
import { isSelectionIconEnabled } from './settings'

const HOST_ID = randomHostId()
const ICON_SIZE = 28
const GAP = 6

let host: HTMLElement | null = null
let iconButton: HTMLButtonElement | null = null

// Showing the icon is async (it reads a setting), so a show already in flight has to be
// cancellable: by the time it resolves the user may have hidden it or selected something
// else. Every hide and every new request bumps this; a request whose token is stale bails.
let generation = 0

export function installSelectionIcon(): void {
  document.addEventListener('mouseup', onMouseUp, true)
  document.addEventListener('selectionchange', onSelectionChange)
  document.addEventListener('keydown', onKeydown, true)
  window.addEventListener('scroll', hideSelectionIcon, true)
  window.addEventListener('resize', hideSelectionIcon)
}

export function hideSelectionIcon(): void {
  generation++
  removeIcon()
}

// Takes the icon off screen without cancelling anything — used by a show that is itself
// replacing the icon.
function removeIcon(): void {
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
  // A selection finished inside our own UI must not raise the icon. The anchor-based guard
  // in maybeShowIcon cannot see it: a closed shadow tree reports the selected text but hides
  // its anchor node, so the walk has nothing to follow. The event path still lists the host,
  // even for a closed tree, so decide from where the release happened.
  const path = event.composedPath()
  if (extensionHosts().some((el) => path.includes(el))) return
  setTimeout(() => void maybeShowIcon(), 0)
}

function extensionHosts(): HTMLElement[] {
  return [host, currentBubbleHost()].filter((el): el is HTMLElement => el !== null)
}

function onSelectionChange(): void {
  if (currentText() === '') hideSelectionIcon()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') hideSelectionIcon()
}

async function maybeShowIcon(): Promise<void> {
  const mine = ++generation
  const enabled = await isSelectionIconEnabled()

  // Hidden (Escape, scroll, cleared selection) or superseded by a newer selection while
  // the setting was being read: this request is void.
  if (mine !== generation) return

  if (!enabled) {
    removeIcon()
    return
  }

  const selection = window.getSelection()
  const text = selection?.toString().trim() ?? ''
  if (text === '' || !selection || insideExtensionUI(selection)) {
    removeIcon()
    return
  }

  const rect = anchorRect(selection)
  if (!rect) {
    removeIcon()
    return
  }

  showIcon(rect, text)
}

function showIcon(rect: DOMRect, text: string): void {
  removeIcon()

  host = document.createElement('div')
  host.id = HOST_ID
  hardenHost(host)
  const shadow = host.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = ICON_CSS
  shadow.appendChild(style)

  const button = document.createElement('button')
  button.className = 'icon'
  button.type = 'button'
  button.title = 'Translate selection'
  button.setAttribute('aria-label', 'Translate selection')

  // The extension's own logo, served as a web-accessible resource: a content script cannot
  // reference packaged files by path.
  const logo = document.createElement('img')
  logo.className = 'logo'
  logo.src = chrome.runtime.getURL('icons/icon48.png')
  logo.alt = ''
  button.appendChild(logo)
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

// Compare element identity rather than ids: an id is page-controlled, so a page could
// otherwise label its own content as ours and suppress the icon over it.
function insideExtensionUI(selection: Selection): boolean {
  const ours = extensionHosts()
  if (ours.length === 0) return false

  let node: Node | null = selection.anchorNode
  while (node) {
    if (ours.includes(node as HTMLElement)) return true
    const root = node.getRootNode()
    node = root instanceof ShadowRoot ? root.host : (node.parentNode ?? null)
  }
  return false
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
/* The logo is already a circular badge with its own ring, so the button adds no chrome of
   its own — just the lift. drop-shadow follows the circle; box-shadow would draw a square. */
.icon {
  position: absolute;
  z-index: 2147483646;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35));
}
.icon:hover {
  filter: drop-shadow(0 2px 7px rgba(0, 0, 0, 0.55));
}
.logo {
  display: block;
  width: 100%;
  height: 100%;
}
`
