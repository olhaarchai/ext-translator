import { languageLabel } from './lib/languages'
import { vocabList, vocabRemove } from './lib/vocab-client'
import { filterEntries } from './lib/vocab-filter'
import { keyOf, type VocabEntry } from './lib/vocab-types'

const listEl = requireEl('list')
const countEl = requireEl('count')
const filterEl = requireEl('filter') as HTMLInputElement

let entries: VocabEntry[] = []

function requireEl(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`missing #${id}`)
  return el
}

async function load(): Promise<void> {
  entries = await vocabList()
  render()
}

function render(): void {
  const shown = filterEntries(entries, filterEl.value)
  countEl.textContent = entries.length === 1 ? '1 record' : `${entries.length} records`
  listEl.replaceChildren()

  if (entries.length === 0) {
    listEl.append(stateRow('Nothing saved yet. Translate something, then tap "Save to vocabulary".'))
    return
  }
  if (shown.length === 0) {
    listEl.append(stateRow('No records match your filter.'))
    return
  }
  for (const entry of shown) listEl.append(entryRow(entry))
}

function entryRow(entry: VocabEntry): HTMLElement {
  const row = div('entry')
  row.append(text('div', 'entry-source', entry.sourceText))
  row.append(text('div', 'entry-translation', entry.translation))

  const foot = div('entry-foot')
  foot.append(
    text('span', 'entry-langs', `${languageLabel(entry.sourceLanguage)} → ${languageLabel(entry.targetLanguage)}`),
  )

  const del = document.createElement('button')
  del.className = 'delete'
  del.textContent = 'Delete'
  del.addEventListener('click', () => void vocabRemove(keyOf(entry)).then(load))
  foot.append(del)

  row.append(foot)
  return row
}

function stateRow(message: string): HTMLElement {
  return text('div', 'state', message)
}

function div(className: string): HTMLElement {
  const node = document.createElement('div')
  node.className = className
  return node
}

function text(tag: string, className: string, content: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  node.textContent = content
  return node
}

filterEl.addEventListener('input', render)

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message?.type === 'vocab-changed') void load()
})

void load()
