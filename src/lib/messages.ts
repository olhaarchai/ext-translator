export type TranslateSelectionMessage = {
  type: 'translate-selection'
  text: string
}

export type VocabChangedMessage = {
  type: 'vocab-changed'
}

export type Message = TranslateSelectionMessage | VocabChangedMessage
