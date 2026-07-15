import type { TranslateSelectionMessage } from './lib/messages'

const MENU_ID = 'translate-selection'

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Translate selection',
      contexts: ['selection'],
      documentUrlPatterns: ['http://*/*', 'https://*/*'],
    })
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
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
