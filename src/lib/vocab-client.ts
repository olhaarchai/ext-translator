import type { VocabEntry, VocabKey } from './vocab-types'

interface VocabResponse {
  ok: boolean
  error?: string
  result?: 'added' | 'exists'
  has?: boolean
  entries?: VocabEntry[]
}

async function send(message: unknown): Promise<VocabResponse> {
  const response = (await chrome.runtime.sendMessage(message)) as VocabResponse | undefined
  if (!response?.ok) throw new Error(response?.error ?? 'vocabulary request failed')
  return response
}

export function vocabAdd(entry: VocabEntry): Promise<'added' | 'exists'> {
  return send({ type: 'vocab-add', entry }).then((r) => r.result ?? 'added')
}

export function vocabRemove(key: VocabKey): Promise<void> {
  return send({ type: 'vocab-remove', key }).then(() => undefined)
}

export function vocabHas(key: VocabKey): Promise<boolean> {
  return send({ type: 'vocab-has', key }).then((r) => r.has ?? false)
}

export function vocabList(): Promise<VocabEntry[]> {
  return send({ type: 'vocab-list' }).then((r) => r.entries ?? [])
}
