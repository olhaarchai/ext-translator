import { openBubble } from './lib/bubble'
import type { Message } from './lib/messages'

declare global {
  interface Window {
    __extTranslatorLoaded?: boolean
  }
}

if (!window.__extTranslatorLoaded) {
  window.__extTranslatorLoaded = true
  chrome.runtime.onMessage.addListener((message: Message) => {
    if (message.type === 'translate-selection') {
      void openBubble(message.text)
    }
  })
}
