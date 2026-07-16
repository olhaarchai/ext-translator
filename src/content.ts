import { notifyVocabChanged, openBubble } from './lib/bubble'
import type { Message } from './lib/messages'
import { installSelectionIcon } from './lib/selection-icon'
import { loadVoicePrefs } from './lib/voice-prefs'

declare global {
  interface Window {
    __extTranslatorLoaded?: boolean
  }
}

if (!window.__extTranslatorLoaded) {
  window.__extTranslatorLoaded = true
  void loadVoicePrefs()
  installSelectionIcon()
  chrome.runtime.onMessage.addListener((message: Message) => {
    if (message.type === 'translate-selection') {
      void openBubble(message.text)
    } else if (message.type === 'vocab-changed') {
      notifyVocabChanged()
    }
  })
}
