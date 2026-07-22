import type { TranslateSelectionMessage } from './lib/messages'
import { addEntry, hasEntry, listEntries, removeEntry } from './lib/vocab-db'
import type { VocabEntry, VocabKey } from './lib/vocab-types'

const MENU_ID = 'translate-selection'
const OPEN_VOCAB_ID = 'open-vocabulary'

chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

// Content scripts read the session-scoped "built-in translation is dead" memo; session
// storage is trusted-contexts-only until opened up.
chrome.storage.session
  ?.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' })
  .catch(() => {})

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Translate selection',
      contexts: ['selection'],
      documentUrlPatterns: ['http://*/*', 'https://*/*'],
    })
    chrome.contextMenus.create({
      id: OPEN_VOCAB_ID,
      title: 'Open Kotiq vocabulary',
      contexts: ['all'],
    })
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === OPEN_VOCAB_ID) {
    // Open synchronously, before any await: the side panel may only open within the click's
    // own user gesture, and awaiting first spends it. A content-script button cannot do this
    // at all — the sidePanel API is not exposed there, and a forwarded gesture is rejected.
    if (tab?.windowId !== undefined) chrome.sidePanel?.open({ windowId: tab.windowId }).catch(() => {})
    return
  }
  if (info.menuItemId !== MENU_ID || tab?.id === undefined) return
  void handleClick(tab.id, info.selectionText ?? '')
})

async function handleClick(tabId: number, selectionText: string): Promise<void> {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
    const message: TranslateSelectionMessage = { type: 'translate-selection', text: selectionText }
    await chrome.tabs.sendMessage(tabId, message)
  } catch {
    // Injection is impossible on browser-internal pages; the menu is scoped to
    // http(s) but a race with navigation can still land here.
  }
}

chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
  if (message?.type !== 'offline-ensure') return
  ensureOffscreen()
    .then((ok) => sendResponse({ ok }))
    .catch(() => sendResponse({ ok: false }))
  return true
})

/**
 * The offline engine runs in an offscreen document: a service worker cannot host its
 * WASM worker, and a content script must not — the model and engine would then live in
 * every page's process. Chrome allows a single offscreen document per extension.
 */
async function ensureOffscreen(): Promise<boolean> {
  if (chrome.offscreen === undefined) return false
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  })
  if (contexts.length > 0) return true
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification:
        'Runs the on-device translation engine in a worker when the browser has no built-in translator.',
    })
    return true
  } catch (error) {
    // Lost a race with another ensure call; any other failure means no offline engine.
    return String(error).includes('single offscreen')
  }
}

type VocabRequest =
  | { type: 'vocab-add'; entry: VocabEntry }
  | { type: 'vocab-remove'; key: VocabKey }
  | { type: 'vocab-has'; key: VocabKey }
  | { type: 'vocab-list' }

const VOCAB_TYPES = new Set(['vocab-add', 'vocab-remove', 'vocab-has', 'vocab-list'])

chrome.runtime.onMessage.addListener((message: VocabRequest, _sender, sendResponse) => {
  if (!message || !VOCAB_TYPES.has(message.type)) return
  handleVocab(message)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: String(error) }))
  return true
})

async function handleVocab(message: VocabRequest): Promise<unknown> {
  switch (message.type) {
    case 'vocab-add': {
      const result = await addEntry(message.entry)
      await broadcastChanged()
      return { ok: true, result }
    }
    case 'vocab-remove': {
      await removeEntry(message.key)
      await broadcastChanged()
      return { ok: true }
    }
    case 'vocab-has':
      return { ok: true, has: await hasEntry(message.key) }
    case 'vocab-list':
      return { ok: true, entries: await listEntries() }
  }
}

async function broadcastChanged(): Promise<void> {
  chrome.runtime.sendMessage({ type: 'vocab-changed' }).catch(() => {})
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id !== undefined) {
      chrome.tabs.sendMessage(tab.id, { type: 'vocab-changed' }).catch(() => {})
    }
  } catch {
    // No active tab to notify; the side-panel broadcast above is enough.
  }
}
