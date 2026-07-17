import { buildSession, closestToTrainable, trainableLanguages, type Card } from './lib/cards'
import { clampedText, expandableText } from './lib/expandable-text'
import { languageLabel } from './lib/languages'
import { isSelectionIconEnabled, setSelectionIconEnabled } from './lib/settings'
import { onVoicesChanged } from './lib/speech'
import { speakerButton } from './lib/speaker-button'
import { spokenLanguage } from './lib/spoken-language'
import { vocabList, vocabRemove } from './lib/vocab-client'
import { filterEntries } from './lib/vocab-filter'
import { keyOf, type VocabEntry } from './lib/vocab-types'
import { loadVoicePrefs } from './lib/voice-prefs'

const listEl = requireEl('list')
const countEl = requireEl('count')
const filterEl = requireEl('filter') as HTMLInputElement
const iconToggleEl = requireEl('icon-toggle') as HTMLInputElement
const vocabViewEl = requireEl('vocab-view')
const trainViewEl = requireEl('train-view')
const trainBodyEl = requireEl('train-body')
const trainProgressEl = requireEl('train-progress')
const trainStartEl = requireEl('train-start') as HTMLButtonElement
const trainExitEl = requireEl('train-exit') as HTMLButtonElement

interface OptionView {
  button: HTMLButtonElement
  option: string
}

let entries: VocabEntry[] = []

// A session is transient: leaving the trainer throws it away (spec 006 contract), which is
// also why deleting an entry mid-session cannot break it — the cards are already built.
let session: Card[] = []
let cardIndex = 0
let correctCount = 0
// The card's outcome is final once given. Tracked here rather than by disabling the
// options, because a disabled button also stops its own "Show more" from firing.
let answered = false

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
  renderTrainAvailability()
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
  // A saved sentence would otherwise take half the panel; expand it on demand instead.
  row.append(expandableText('div', 'entry-source', entry.sourceText))
  row.append(expandableText('div', 'entry-translation', entry.translation))

  const foot = div('entry-foot')
  const left = div('entry-left')
  left.append(
    spokenLanguage(entry.sourceText, entry.sourceLanguage, 'entry-langs'),
    text('span', 'entry-langs', '→'),
    spokenLanguage(entry.translation, entry.targetLanguage, 'entry-langs'),
  )
  foot.append(left)

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

function renderTrainAvailability(): void {
  const languages = trainableLanguages(entries)
  trainStartEl.disabled = languages.length === 0

  if (languages.length > 0) {
    trainStartEl.textContent = `Train ${languageLabel(languages[0]!)}`
    return
  }

  // Say what is missing, and in which language: the rule ("4 in one language") is not
  // something the reader should have to apply to their own list.
  const closest = closestToTrainable(entries)
  trainStartEl.textContent =
    closest === null
      ? 'Train — save some words first'
      : `Train — ${closest.missing} more in ${languageLabel(closest.language)}`
}

function showTrainer(show: boolean): void {
  vocabViewEl.classList.toggle('hidden', show)
  trainViewEl.classList.toggle('hidden', !show)
}

function startTraining(): void {
  const language = trainableLanguages(entries)[0]
  if (language === undefined) return

  session = buildSession(entries, language)
  cardIndex = 0
  correctCount = 0
  showTrainer(true)
  renderCard()
}

function exitTraining(): void {
  session = []
  showTrainer(false)
  void load()
}

function renderCard(): void {
  const card = session[cardIndex]
  if (!card) {
    renderScore()
    return
  }

  trainProgressEl.textContent = `${cardIndex + 1} / ${session.length}`
  trainBodyEl.replaceChildren()
  answered = false

  const prompt = div('prompt')
  const speaker = speakerButton(card.entry.sourceText, card.entry.sourceLanguage)
  if (speaker) prompt.append(speaker)
  prompt.append(expandableText('div', 'prompt-text', card.entry.sourceText))
  trainBodyEl.append(prompt)

  const options: OptionView[] = []
  for (const option of card.options) {
    const { text: label, hint } = clampedText('span', 'option-text', option)
    const button = document.createElement('button')
    button.className = 'option'
    button.type = 'button'
    button.append(label)
    button.addEventListener('click', () => answer(card, option, options))
    options.push({ button, option })

    const wrap = div('option-wrap')
    wrap.append(button)
    // Beside the button, never inside it: expanding and answering must not compete for
    // the same click, and the hint has to outlive the answer.
    if (hint !== null) wrap.append(hint)
    trainBodyEl.append(wrap)
  }
}

function answer(card: Card, chosen: string, options: OptionView[]): void {
  if (answered) return
  answered = true

  const right = chosen === card.answer
  if (right) correctCount++

  for (const view of options) {
    view.button.classList.add('answered')
    view.button.setAttribute('aria-disabled', 'true')
    if (view.option === card.answer) view.button.classList.add('correct')
    else if (view.option === chosen) view.button.classList.add('wrong')
  }

  const verdict = text('p', 'verdict', right ? 'Correct' : `Correct answer: ${card.answer}`)
  // The verdict is the whole point of the card; announce it rather than only colouring it.
  verdict.setAttribute('role', 'status')
  trainBodyEl.append(verdict)

  const next = document.createElement('button')
  next.className = 'primary'
  next.type = 'button'
  next.textContent = cardIndex + 1 < session.length ? 'Next' : 'Finish'
  next.addEventListener('click', () => {
    cardIndex++
    renderCard()
  })
  trainBodyEl.append(next)
  // Answering disables nothing now, but the chosen option is spent; move on from it so the
  // keyboard does not fall back to the top of the document on every card.
  next.focus()
}

function renderScore(): void {
  trainProgressEl.textContent = 'Done'
  trainBodyEl.replaceChildren(
    text('div', 'score', `${correctCount} of ${session.length} correct`),
  )

  const again = document.createElement('button')
  again.className = 'primary'
  again.type = 'button'
  again.textContent = 'Back to vocabulary'
  again.addEventListener('click', exitTraining)
  trainBodyEl.append(again)
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

trainStartEl.addEventListener('click', startTraining)
trainExitEl.addEventListener('click', exitTraining)

iconToggleEl.addEventListener('change', () => {
  void setSelectionIconEnabled(iconToggleEl.checked)
})

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message?.type === 'vocab-changed') void load()
})

onVoicesChanged(render)

async function loadIconSetting(): Promise<void> {
  iconToggleEl.checked = await isSelectionIconEnabled()
}

void loadVoicePrefs()
void loadIconSetting()
void load()
